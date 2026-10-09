import {
  InjectQueue,
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Queue } from "bullmq";

import { QueueName } from "#/infra/queue/queue.constants.js";
import {
  parseRecordingMixJobId,
  type RecordingMixJobResult,
} from "#/modules/recording/queue/recording-queue.types.js";
import { RecordingService } from "#/modules/recording/services/recording.service.js";

/**
 * `tts` kuyruğundaki `mix-*` işlerinin olayları. Seslendirme işleri belge
 * modülündeki dinleyicide; ikisi kimlik önekine göre kendi işlerini alır.
 */
@QueueEventsListener(QueueName.TTS)
export class RecordingMixQueueEvents extends QueueEventsHost {
  private readonly logger = new Logger(RecordingMixQueueEvents.name);

  constructor(
    private readonly recordingService: RecordingService,
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
    const target = parseRecordingMixJobId(jobId);
    if (!target) return;
    this.logger.log(`✅ [Kuyruk:tts] Kayıt birleştirildi Job#${jobId}`);
    await this.run(() =>
      this.recordingService.completeMix(
        target.recordingId,
        target.run,
        (typeof returnvalue === "string"
          ? JSON.parse(returnvalue)
          : returnvalue) as RecordingMixJobResult,
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
    const target = parseRecordingMixJobId(jobId);
    if (!target) return;
    this.logger.warn(
      `❌ [Kuyruk:tts] Kayıt birleştirme Job#${jobId}: ${failedReason}`,
    );
    // Denemesi kalan iş yeniden çalışacak.
    if ((await this.queue.getJobState(jobId)) !== "failed") return;
    await this.run(() =>
      this.recordingService.failMix(target.recordingId, target.run),
    );
  }

  private async run(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.error(
        `Kayıt birleştirme olayı işlenemedi: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
