import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { QueueName } from "#/infra/queue/queue.constants.js";
import {
  PushJobName,
  type PushJobData,
} from "#/modules/notification/queue/push.types.js";

/** `push` kuyruğunun PRODUCER'ı. */
@Injectable()
export class PushQueueService {
  constructor(
    @InjectQueue(QueueName.PUSH)
    private readonly queue: Queue<PushJobData>,
  ) {}

  /** `dedupeKey` verilirse aynı bildirim iki kez gönderilmez. */
  async enqueue(data: PushJobData, dedupeKey?: string): Promise<void> {
    await this.queue.add(
      PushJobName.SEND,
      data,
      dedupeKey ? { jobId: `push-${dedupeKey}` } : {},
    );
  }
}
