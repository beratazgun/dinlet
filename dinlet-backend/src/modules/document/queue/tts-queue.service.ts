import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { QueueName } from "#/infra/queue/queue.constants.js";
import {
  DocumentJobName,
  type TtsJobData,
} from "#/modules/document/queue/document-queue.types.js";

/** `tts` kuyruğunun PRODUCER'ı (tüketici Python worker). */
@Injectable()
export class TtsQueueService {
  constructor(
    @InjectQueue(QueueName.TTS)
    private readonly queue: Queue<TtsJobData>,
  ) {}

  /**
   * Aynı metin için aynı job tekrar eklenmez; yeniden denemede `attempt`
   * artar (başarısız job DLQ'da durduğu sürece aynı id yeniden eklenemez).
   * BullMQ özel kimliklerde `:` kabul etmediği için ayırıcı `-`.
   */
  static jobId(sectionId: number, scriptHash: string, attempt: number): string {
    return `tts-${sectionId}-${scriptHash}-${attempt}`;
  }

  async enqueue(
    data: TtsJobData,
    options: { scriptHash: string; attempt: number; priority: number },
  ): Promise<void> {
    await this.queue.add(DocumentJobName.SYNTHESIZE, data, {
      jobId: TtsQueueService.jobId(
        data.sectionId,
        options.scriptHash,
        options.attempt,
      ),
      priority: options.priority,
    });
  }

  /** Hızlı tekrar sesi — `ttsq-{sectionId}-{quickHash}-{attempt}`. */
  async enqueueQuick(
    data: TtsJobData,
    options: { quickHash: string; attempt: number; priority: number },
  ): Promise<void> {
    await this.queue.add(DocumentJobName.SYNTHESIZE, data, {
      jobId: `ttsq-${data.sectionId}-${options.quickHash}-${options.attempt}`,
      priority: options.priority,
    });
  }

  /** Hafıza kancasının sesi — `ttsm-{mnemonicId}-{run}`. */
  async enqueueMnemonic(
    mnemonicId: number,
    data: TtsJobData,
    options: { run: number; priority: number },
  ): Promise<void> {
    await this.queue.add(DocumentJobName.SYNTHESIZE, data, {
      jobId: `ttsm-${mnemonicId}-${options.run}`,
      priority: options.priority,
    });
  }

  getQueue(): Queue<TtsJobData> {
    return this.queue;
  }
}
