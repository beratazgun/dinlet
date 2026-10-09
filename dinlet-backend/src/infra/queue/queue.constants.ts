import type { JobsOptions } from "bullmq";

/**
 * Tüm BullMQ kuyruklarının adları TEK yerde tutulur.
 * Yeni bir kuyruk eklerken önce buraya adını ekle.
 */
export const QueueName = {
  EMAIL: "email",
  AUDIT_LOG: "audit-log",
  /** PDF → Markdown (Docling). Tüketici: Python worker. */
  EXTRACT: "extract",
  /** Bölümleme + (Pro) LLM ile anlatım. Tüketici: NestJS. */
  DOCUMENT_PROCESS: "document-process",
  /** Normalizasyon + ses + MP3. Tüketici: Python worker. */
  TTS: "tts",
  /** Expo push bildirimi. */
  PUSH: "push",
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

/**
 * `QueueModule`'ün kaydettiği ortak (shared) kuyruklar. Tek bir modüle ait
 * kuyruklar (ör. `AUDIT_LOG`) o modülün `*.module.ts`'inde
 * `BullModule.registerQueue` ile kaydedilir.
 */
export const SHARED_QUEUES: QueueName[] = [QueueName.EMAIL];

/**
 * Bütün kuyruklar için ortak varsayılan job opsiyonları.
 *
 * - `attempts` + üstel `backoff`: geçici hatalarda otomatik yeniden deneme.
 * - `removeOnComplete`: başarılı job'ları kısa süre tut (Redis şişmesin).
 * - `removeOnFail`: başarısızları 24 saat tut → basit bir DLQ (inceleme) alanı.
 *
 * Bir kuyruk farklı davranış istiyorsa `registerQueue({ defaultJobOptions })`
 * ile ya da `queue.add(name, data, { ...override })` ile üzerine yazabilir.
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 24 * 3_600 },
};
