import { WorkerHost } from "@nestjs/bullmq";
import type { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

/**
 * Tüm kuyruk worker'larının türediği taban sınıf.
 *
 * Amaç: her processor'da tekrar eden log/hata/retry/DLQ görünürlüğünü tek yerde
 * standartlaştırmak. Alt sınıf yalnızca iki şeyi verir:
 *   1. `logger` — kendi adıyla bir `Logger`.
 *   2. `handle(job)` — asıl işi yapan metod.
 *
 * `process()` bu sınıfta uygulanır ve şunları garanti eder:
 *   - Başlangıç/bitiş + süre logu.
 *   - Hata olursa deneme sayısına göre `retry` (warn) / `DLQ` (error) logu,
 *     ardından hatayı YENİDEN fırlatır (BullMQ backoff/retry devreye girsin).
 *
 * Not: `@OnWorkerEvent` dekoratörleri BullMQ explorer tarafından yalnızca
 * alt-sınıf prototibinden taranır (miras alınanlar keşfedilmez). Bu yüzden
 * ortak hata görünürlüğünü event handler yerine `process()` içinde topluyoruz —
 * böylece miras güvenli çalışır.
 */
export abstract class BaseProcessor<TData = unknown> extends WorkerHost {
  protected abstract readonly logger: Logger;

  /** Asıl iş mantığı. Hata durumunda fırlat; retry/DLQ base tarafından yönetilir. */
  abstract handle(job: Job<TData>): Promise<void>;

  async process(job: Job<TData>): Promise<void> {
    const startedAt = Date.now();
    this.logger.debug(`▶️  ${job.name} başladı (job#${job.id})`);

    try {
      await this.handle(job);
      this.logger.debug(
        `✅ ${job.name} tamamlandı (job#${job.id}, ${Date.now() - startedAt}ms)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const maxAttempts = job.opts.attempts ?? 1;
      const currentAttempt = job.attemptsMade + 1;
      const exhausted = currentAttempt >= maxAttempts;

      this.logger[exhausted ? "error" : "warn"](
        `${exhausted ? "💀 DLQ" : "🔁 retry"} ${job.name} ` +
          `(deneme ${currentAttempt}/${maxAttempts}, job#${job.id}): ${message}`,
      );

      // BullMQ'nun retry/backoff'u için hatayı yeniden fırlat.
      throw error;
    }
  }
}
