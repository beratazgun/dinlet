import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";

import { DatabaseService } from "#database/database.service.js";
import { asCronPattern, asJobCode, asJobName } from "#database/scalars.js";
import type { CreateJobBodyDto, UpdateJobBodyDto } from "#/infra/job/dtos/index.js";
import { JobExecutorService } from "#/infra/job/services/job-executor.service.js";

@Injectable()
export class JobSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(JobSchedulerService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly jobExecutor: JobExecutorService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadJobsFromDatabase();
  }

  async loadJobsFromDatabase(): Promise<void> {
    try {
      const jobs = await this.database.client.orm.public.Job.where({
        isActive: true,
      }).all();

      for (const job of jobs) {
        this.addCronJob(job.code, job.cronPattern);
      }

      this.logger.log(`Loaded ${jobs.length} jobs from database`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to load jobs from database: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private addCronJob(jobCode: string, cronPattern: string): void {
    try {
      if (this.schedulerRegistry.doesExist("cron", jobCode)) {
        this.schedulerRegistry.deleteCronJob(jobCode);
      }

      const job = new CronJob(cronPattern, () => {
        void this.jobExecutor
          .executeJob(jobCode, "CRON")
          .catch((error: unknown) => {
            this.logger.error(
              `Scheduled job ${jobCode} failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
      });

      this.schedulerRegistry.addCronJob(jobCode, job);
      job.start();
      this.logger.log(
        `Job "${jobCode}" scheduled with pattern: ${cronPattern}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to add cron job "${jobCode}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createJob(data: CreateJobBodyDto) {
    const job = await this.database.client.orm.public.Job.create({
      code: asJobCode(data.code),
      name: asJobName(data.name),
      cronPattern: asCronPattern(data.cronPattern),
      description: data.description ?? null,
      category: data.category ?? "MAINTENANCE",
      isActive: data.isActive ?? true,
      retryLimit: data.retryLimit ?? 3,
      params: data.params ?? null,
    });

    if (job.isActive) this.addCronJob(job.code, job.cronPattern);
    return job;
  }

  async updateJob(code: string, data: UpdateJobBodyDto) {
    const existing = await this.database.client.orm.public.Job.where({
      code: asJobCode(code),
    }).first();
    if (!existing) throw new NotFoundException(`Job not found: ${code}`);

    const { name, cronPattern, ...rest } = data;
    const job = await this.database.client.orm.public.Job.where({
      code: asJobCode(code),
    }).update({
      ...rest,
      ...(name === undefined ? {} : { name: asJobName(name) }),
      ...(cronPattern === undefined
        ? {}
        : { cronPattern: asCronPattern(cronPattern) }),
    });

    if (!job) throw new NotFoundException(`Job not found: ${code}`);

    if (this.schedulerRegistry.doesExist("cron", code)) {
      this.schedulerRegistry.deleteCronJob(code);
    }

    if (job.isActive) this.addCronJob(job.code, job.cronPattern);
    return job;
  }

  async stopJob(code: string): Promise<void> {
    if (this.schedulerRegistry.doesExist("cron", code)) {
      this.schedulerRegistry.deleteCronJob(code);
    }

    await this.database.client.orm.public.Job.where({
      code: asJobCode(code),
    }).update({ isActive: false });
  }

  async startJob(code: string): Promise<void> {
    const job = await this.database.client.orm.public.Job.where({
      code: asJobCode(code),
    }).first();
    if (!job) throw new NotFoundException(`Job not found: ${code}`);

    await this.database.client.orm.public.Job.where({
      code: asJobCode(code),
    }).update({ isActive: true });
    this.addCronJob(job.code, job.cronPattern);
  }

  runJobManually(code: string) {
    return this.jobExecutor.executeJob(code, "MANUAL");
  }
}
