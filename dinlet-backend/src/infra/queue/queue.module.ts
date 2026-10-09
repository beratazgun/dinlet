import { BullModule } from "@nestjs/bullmq";
import { Global, Module, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvType } from "#config/env.validation.js";
import {
  DEFAULT_JOB_OPTIONS,
  SHARED_QUEUES,
} from "#/infra/queue/queue.constants.js";
import {
  EmailProcessor,
  EmailQueueService,
} from "#/infra/queue/queues/email/index.js";

/**
 * Kuyruk PRODUCER'ları (enqueue API'leri). Global export edilir → her yerden
 * enjekte edilebilir. Yeni kuyruk eklerken producer'ını buraya ekle.
 */
const QueueProducers: Provider[] = [EmailQueueService];

/**
 * Kuyruk WORKER'ları (processor'lar). Export edilmez; sadece bu modülde çalışır.
 * Yeni kuyruk eklerken processor'ını buraya ekle.
 */
const QueueProcessors: Provider[] = [EmailProcessor];

/**
 * BullMQ tabanlı asenkron iş kuyruğu altyapısı.
 *
 * - Bağlantı: mevcut Redis (config'ten). BullMQ kendi (blocking) bağlantılarını
 *   yönetir; bu yüzden RedisModule'ün paylaşımlı client'ı yerine config veriyoruz.
 * - `DEFAULT_JOB_OPTIONS`: tüm kuyruklara ortak retry/backoff/DLQ davranışı.
 * - `SHARED_QUEUES`'daki her ad otomatik register edilir; modüle özel kuyruklar
 *   (ör. `AUDIT_LOG`) kendi modüllerinde register edilir.
 *
 * Yeni kuyruk ekleme reçetesi: `references/bullmq-queues.md` (project-standards).
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvType>) => ({
        connection: {
          host: config.get("REDIS_HOST", { infer: true }),
          port: Number(config.get("REDIS_PORT", { infer: true })),
          password: config.get("REDIS_PASSWORD", { infer: true }) || undefined,
        },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
    // Ortak kuyrukları tek seferde register et.
    BullModule.registerQueue(...SHARED_QUEUES.map((name) => ({ name }))),
  ],
  providers: [...QueueProducers, ...QueueProcessors],
  exports: [...QueueProducers],
})
export class QueueModule {}
