import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import type { JsonValue } from "@prisma/orm-postgres/target/codec-types";

import { DatabaseService } from "#database/database.service.js";
import { asJobCode } from "#database/scalars.js";
import type {
  AbstractJobHandler,
  JobParams,
} from "#/infra/job/handlers/abstract.handler.js";

@Injectable()
export class JobExecutorService implements OnModuleInit {
  private readonly logger = new Logger(JobExecutorService.name);
  private readonly handlers = new Map<string, AbstractJobHandler>();

  constructor(
    private readonly database: DatabaseService,
    @Inject("JOB_HANDLERS") private readonly jobHandlers: AbstractJobHandler[],
  ) {}

  onModuleInit(): void {
    for (const handler of this.jobHandlers) {
      const jobCode = handler.getJobCode();
      this.handlers.set(jobCode, handler);
      this.logger.log(`Registered job handler: ${jobCode}`);
    }
  }

  async executeJob(jobCode: string, triggeredBy = "CRON") {
    const job = await this.database.client.orm.public.Job.where({
      code: asJobCode(jobCode),
      isActive: true,
    }).first();

    if (!job) {
      throw new NotFoundException(`Job not found or inactive: ${jobCode}`);
    }

    const execution = await this.database.client.orm.public.JobExecution.create(
      {
        jobId: job.id,
        status: "RUNNING",
        metadata: { triggeredBy },
      },
    );
    const startTime = Date.now();

    try {
      const handler = this.handlers.get(job.code);
      if (!handler) throw new Error(`No handler found for job: ${job.code}`);

      const params = this.normalizeParams(job.params);
      const timeoutMs =
        typeof params.timeoutSeconds === "number"
          ? params.timeoutSeconds * 1_000
          : 5 * 60 * 1_000;
      const result = await Promise.race([
        handler.execute(params),
        this.timeout(timeoutMs),
      ]);
      const duration = Date.now() - startTime;
      const now = new Date().toISOString();

      await this.database.client.transaction(async (tx) => {
        await tx.orm.public.JobExecution.where({ id: execution.id }).update({
          status: "SUCCESS",
          endTime: now,
          duration,
          affectedRows: result.affectedRows,
          metadata: this.toJsonRecord(result.metadata ?? { triggeredBy }),
        });
        await tx.orm.public.Job.where({ id: job.id }).update({
          lastExecutionAt: now,
          lastSuccessAt: now,
          consecutiveFailures: 0,
        });
      });

      this.logger.log(`Job ${jobCode} completed successfully in ${duration}ms`);
      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message === "TIMEOUT";
      const now = new Date().toISOString();

      await this.database.client.transaction(async (tx) => {
        await tx.orm.public.JobExecution.where({ id: execution.id }).update({
          status: isTimeout ? "TIMEOUT" : "FAILED",
          endTime: now,
          duration,
          errorMessage: error instanceof Error ? error.message : String(error),
          retryCount: execution.retryCount + 1,
        });
        await tx.orm.public.Job.where({ id: job.id }).update({
          lastExecutionAt: now,
          lastFailureAt: now,
          consecutiveFailures: job.consecutiveFailures + 1,
        });
      });

      this.logger.error(
        `Job ${jobCode} failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      if (execution.retryCount < job.retryLimit) {
        setTimeout(() => {
          void this.executeJob(jobCode, "RETRY").catch(
            (retryError: unknown) => {
              this.logger.error(
                `Retry for ${jobCode} failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
              );
            },
          );
        }, 5_000);
      }

      throw error;
    }
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), ms),
    );
  }

  private normalizeParams(params: unknown): JobParams {
    return params !== null &&
      typeof params === "object" &&
      !Array.isArray(params)
      ? (params as JobParams)
      : {};
  }

  private toJsonRecord(value: Record<string, unknown>): JsonValue {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  }
}
