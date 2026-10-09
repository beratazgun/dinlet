import { getQueueToken } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import type { Queue } from "bullmq";

import type { EnvType } from "#config/env.validation.js";
import { DateManager } from "#/core/utils/date-manager.js";
import type {
  AbstractJobHandler,
  JobExecutionResult,
  JobParams,
} from "#/infra/job/handlers/abstract.handler.js";
import { QueueName } from "#/infra/queue/queue.constants.js";
import { EmailQueueService } from "#/infra/queue/queues/email/index.js";
import { RedisService } from "#/infra/redis/redis.service.js";

const DEFAULT_MAX_WAIT_MINUTES = 120;
const SAMPLE_SIZE = 100;
const MINUTE_MS = 60_000;

/**
 * Kuyruk alarmı (doküman §11 "İzleme"): son kontrolden beri DLQ'ya düşen
 * (denemeleri tükenmiş) işler ve `tts` kuyruğunda `params.maxWaitMinutes`'tan
 * (varsayılan 120) uzun bekleyen işler için `ALERT_EMAIL`'e e-posta gönderir.
 */
@Injectable()
export class QueueHealthAlertHandler implements AbstractJobHandler {
  private readonly logger = new Logger(QueueHealthAlertHandler.name);
  private readonly alertEmail?: string;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly emailQueue: EmailQueueService,
    private readonly redisService: RedisService,
    private readonly dateManager: DateManager,
    configService: ConfigService<EnvType>,
  ) {
    this.alertEmail = configService.get("ALERT_EMAIL", { infer: true });
  }

  getJobCode(): string {
    return "QUEUE_HEALTH_ALERT";
  }

  async execute(params: JobParams = {}): Promise<JobExecutionResult> {
    const maxWaitMinutes =
      typeof params.maxWaitMinutes === "number" && params.maxWaitMinutes > 0
        ? params.maxWaitMinutes
        : DEFAULT_MAX_WAIT_MINUTES;
    const now = this.dateManager.utcNow().getTime();

    const checkedKey = this.redisService.createKey("QUEUE_ALERT_CHECKED", "all");
    const lastChecked = Number(await this.redisService.get(checkedKey)) || now;
    await this.redisService.set(checkedKey, String(now));

    const issues = [
      ...(await this.findNewFailures(lastChecked)),
      ...(await this.findLongWait(QueueName.TTS, maxWaitMinutes, now)),
    ];
    if (issues.length === 0) return { affectedRows: 0 };

    if (!this.alertEmail) {
      this.logger.warn(`Kuyruk uyarısı (ALERT_EMAIL yok):\n${issues.join("\n")}`);
      return { affectedRows: issues.length, metadata: { issues, emailed: false } };
    }
    await this.emailQueue.enqueueEmail({
      to: this.alertEmail,
      code: "OPS_ALERT",
      variables: {
        title: `${issues.length} kuyruk sorunu`,
        details: issues.join("\n"),
        checkedAt: this.dateManager.getFormattedDate(new Date(now), "dd.MM.yyyy HH:mm"),
      },
    });
    return { affectedRows: issues.length, metadata: { issues, emailed: true } };
  }

  private queue(name: string): Queue {
    return this.moduleRef.get<Queue>(getQueueToken(name), { strict: false });
  }

  /** Son kontrolden sonra DLQ'ya düşen işler (kuyruk başına). */
  private async findNewFailures(since: number): Promise<string[]> {
    const issues: string[] = [];
    for (const name of Object.values(QueueName)) {
      const failed = await this.queue(name).getJobs(["failed"], 0, SAMPLE_SIZE - 1, false);
      const fresh = failed.filter((job) => job && (job.finishedOn ?? 0) > since);
      if (fresh.length > 0) {
        issues.push(
          `${name}: ${fresh.length} iş DLQ'ya düştü (son hata: ${fresh[0]!.failedReason ?? "bilinmiyor"})`,
        );
      }
    }
    return issues;
  }

  /** Kuyruktaki en eski bekleyen iş eşiği aştıysa (saatte bir uyarı). */
  private async findLongWait(
    name: string,
    maxWaitMinutes: number,
    now: number,
  ): Promise<string[]> {
    const queue = this.queue(name);
    const waiting = await queue.getJobs(["waiting", "prioritized"], 0, SAMPLE_SIZE - 1, true);
    const oldest = Math.min(...waiting.filter(Boolean).map((job) => job.timestamp));
    if (!Number.isFinite(oldest)) return [];

    const waitedMinutes = Math.floor((now - oldest) / MINUTE_MS);
    if (waitedMinutes <= maxWaitMinutes) return [];

    const mutedKey = this.redisService.createKey("QUEUE_ALERT_WAIT", name);
    if (await this.redisService.get(mutedKey)) return [];
    await this.redisService.set(mutedKey, "1");

    const counts = await queue.getJobCounts("waiting", "prioritized");
    const total = (counts.waiting ?? 0) + (counts.prioritized ?? 0);
    return [`${name}: ${total} iş bekliyor; en eskisi ${waitedMinutes} dakikadır sırada`];
  }
}
