import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { QueueName } from "#/infra/queue/queue.constants.js";
import {
  DocumentJobName,
  type ExtractJobData,
} from "#/modules/document/queue/document-queue.types.js";

/** `extract` kuyruğunun PRODUCER'ı (tüketici Python worker). */
@Injectable()
export class ExtractQueueService {
  constructor(
    @InjectQueue(QueueName.EXTRACT)
    private readonly queue: Queue<ExtractJobData>,
  ) {}

  static jobId(documentId: number): string {
    return `extract-${documentId}`;
  }

  async enqueue(data: ExtractJobData, priority: number): Promise<void> {
    await this.queue.add(DocumentJobName.EXTRACT, data, {
      jobId: ExtractQueueService.jobId(data.documentId),
      priority,
    });
  }

  getQueue(): Queue<ExtractJobData> {
    return this.queue;
  }
}
