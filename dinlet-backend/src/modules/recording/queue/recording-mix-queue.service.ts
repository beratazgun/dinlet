import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { QueueName } from "#/infra/queue/queue.constants.js";
import {
  RECORDING_MIX_JOB,
  recordingMixJobId,
  type RecordingMixJobData,
} from "#/modules/recording/queue/recording-queue.types.js";

/** Kayıt birleştirmenin PRODUCER'ı (tüketici Python worker, `tts` kuyruğu). */
@Injectable()
export class RecordingMixQueueService {
  constructor(
    @InjectQueue(QueueName.TTS)
    private readonly queue: Queue<RecordingMixJobData>,
  ) {}

  async enqueue(data: RecordingMixJobData, run: number): Promise<void> {
    await this.queue.add(RECORDING_MIX_JOB, data, {
      jobId: recordingMixJobId(data.recordingId, run),
      // Kullanıcı ekranda bekliyor; seslendirme işlerinin önüne geçer.
      priority: 1,
      attempts: 2,
    });
  }
}
