import {
  InjectQueue,
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Queue } from "bullmq";

import { QueueName } from "#/infra/queue/queue.constants.js";
import type {
  ExtractJobResult,
  TtsJobResult,
} from "#/modules/document/queue/document-queue.types.js";
import { DocumentPipelineService } from "#/modules/document/services/document-pipeline.service.js";
import { StudyGenerationService } from "#/modules/document/services/study-generation.service.js";

/** `extract-{documentId}` */
export function parseExtractJobId(jobId: string): number | null {
  const match = /^extract-(\d+)$/.exec(jobId);
  return match ? Number(match[1]) : null;
}

/** `tts-{sectionId}-{scriptHash}-{attempt}` */
export function parseTtsJobId(
  jobId: string,
): { sectionId: number; scriptHash: string } | null {
  const match = /^tts-(\d+)-([0-9a-f]+)-\d+$/.exec(jobId);
  return match ? { sectionId: Number(match[1]), scriptHash: match[2]! } : null;
}

/** Hızlı tekrar sesi: `ttsq-{sectionId}-{quickHash}-{attempt}` */
export function parseQuickTtsJobId(
  jobId: string,
): { sectionId: number; quickHash: string } | null {
  const match = /^ttsq-(\d+)-([0-9a-f]+)-\d+$/.exec(jobId);
  return match ? { sectionId: Number(match[1]), quickHash: match[2]! } : null;
}

/** Hafıza kancası sesi: `ttsm-{mnemonicId}-{run}` */
export function parseMnemonicTtsJobId(jobId: string): number | null {
  const match = /^ttsm-(\d+)-\d+$/.exec(jobId);
  return match ? Number(match[1]) : null;
}

/** BullMQ dönüş değerini string (Redis) veya nesne olarak kabul eder. */
function parseReturnValue<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

/**
 * Python worker'ın tükettiği `extract` kuyruğunun olayları. İş sonuçları
 * NestJS'e yalnızca bu olaylarla döner (iki servis birbirini çağırmaz).
 *
 * Olaylar Redis stream'den okunur; API kapalıyken kaçan olaylar periyodik
 * uzlaştırıcıyla (`DocumentReconcileService`) toplanır.
 */
@QueueEventsListener(QueueName.EXTRACT)
export class ExtractQueueEvents extends QueueEventsHost {
  private readonly logger = new Logger(ExtractQueueEvents.name);

  constructor(
    private readonly pipeline: DocumentPipelineService,
    @InjectQueue(QueueName.EXTRACT) private readonly queue: Queue,
  ) {
    super();
  }

  @OnQueueEvent("active")
  async onActive({ jobId }: { jobId: string }): Promise<void> {
    const documentId = parseExtractJobId(jobId);
    this.logger.log(`⚙️ [Kuyruk:extract] Job#${jobId} aktif (belge#${documentId})`);
    if (documentId) await this.run(() => this.pipeline.markExtracting(documentId));
  }

  @OnQueueEvent("completed")
  async onCompleted({
    jobId,
    returnvalue,
  }: {
    jobId: string;
    returnvalue: unknown;
  }): Promise<void> {
    const documentId = parseExtractJobId(jobId);
    this.logger.log(`✅ [Kuyruk:extract] Job#${jobId} tamamlandı (belge#${documentId})`);
    if (!documentId) return;
    await this.run(() =>
      this.pipeline.completeExtraction(
        documentId,
        parseReturnValue<ExtractJobResult>(returnvalue),
      ),
    );
  }

  /** Yalnızca denemeleri tükenmiş (kalıcı) başarısızlık işlenir. */
  @OnQueueEvent("failed")
  async onFailed({
    jobId,
    failedReason,
  }: {
    jobId: string;
    failedReason: string;
  }): Promise<void> {
    const documentId = parseExtractJobId(jobId);
    this.logger.warn(
      `❌ [Kuyruk:extract] Job#${jobId} başarısız oldu (belge#${documentId}): ${failedReason}`,
    );
    if (!documentId) return;
    if ((await this.queue.getJobState(jobId)) !== "failed") return;
    await this.run(() => this.pipeline.failExtraction(documentId, failedReason));
  }

  private async run(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.error(
        `extract olayı işlenemedi: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** Python worker'ın tükettiği `tts` kuyruğunun olayları. */
@QueueEventsListener(QueueName.TTS)
export class TtsQueueEvents extends QueueEventsHost {
  private readonly logger = new Logger(TtsQueueEvents.name);

  constructor(
    private readonly pipeline: DocumentPipelineService,
    private readonly studyGeneration: StudyGenerationService,
    @InjectQueue(QueueName.TTS) private readonly queue: Queue,
  ) {
    super();
  }

  @OnQueueEvent("completed")
  async onCompleted({
    jobId,
    returnvalue,
  }: {
    jobId: string;
    returnvalue: unknown;
  }): Promise<void> {
    const quick = parseQuickTtsJobId(jobId);
    if (quick) {
      await this.run(() =>
        this.studyGeneration.completeQuick(
          quick.sectionId,
          quick.quickHash,
          parseReturnValue<TtsJobResult>(returnvalue),
        ),
      );
      return;
    }
    const mnemonicId = parseMnemonicTtsJobId(jobId);
    if (mnemonicId) {
      await this.run(() =>
        this.studyGeneration.completeMnemonicAudio(
          mnemonicId,
          parseReturnValue<TtsJobResult>(returnvalue),
        ),
      );
      return;
    }
    const target = parseTtsJobId(jobId);
    this.logger.log(`✅ [Kuyruk:tts] Job#${jobId} tamamlandı (bölüm#${target?.sectionId})`);
    if (!target) return;
    await this.run(() =>
      this.pipeline.completeSynthesis(
        target.sectionId,
        parseReturnValue<TtsJobResult>(returnvalue),
      ),
    );
  }

  @OnQueueEvent("failed")
  async onFailed({
    jobId,
    failedReason,
  }: {
    jobId: string;
    failedReason: string;
  }): Promise<void> {
    const quick = parseQuickTtsJobId(jobId);
    if (quick) {
      this.logger.warn(`❌ [Kuyruk:tts] Hızlı tekrar sesi Job#${jobId}: ${failedReason}`);
      if ((await this.queue.getJobState(jobId)) !== "failed") return;
      await this.run(() => this.studyGeneration.failQuick(quick.sectionId));
      return;
    }
    if (parseMnemonicTtsJobId(jobId)) {
      // Kanca sesi üretilemezse kanca saklı kalır, yalnızca okunmaz.
      this.logger.warn(`❌ [Kuyruk:tts] Hafıza kancası sesi Job#${jobId}: ${failedReason}`);
      return;
    }
    const target = parseTtsJobId(jobId);
    this.logger.warn(
      `❌ [Kuyruk:tts] Job#${jobId} başarısız oldu (bölüm#${target?.sectionId}): ${failedReason}`,
    );
    if (!target) return;
    if ((await this.queue.getJobState(jobId)) !== "failed") return;
    await this.run(() =>
      this.pipeline.failSynthesis(
        target.sectionId,
        target.scriptHash,
        failedReason,
      ),
    );
  }

  private async run(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.error(
        `tts olayı işlenemedi: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
