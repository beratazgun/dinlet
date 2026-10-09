import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { QueueName } from "#/infra/queue/queue.constants.js";
import {
  DocumentJobName,
  type DocumentProcessJobData,
} from "#/modules/document/queue/document-queue.types.js";

/** `document-process` kuyruğunun PRODUCER'ı. */
@Injectable()
export class DocumentProcessQueueService {
  constructor(
    @InjectQueue(QueueName.DOCUMENT_PROCESS)
    private readonly queue: Queue<DocumentProcessJobData>,
  ) {}

  /** Yeniden işlemede `run` artar; ilk çalıştırma `doc-{id}`. */
  static jobId(documentId: number, run = 0): string {
    return run === 0 ? `doc-${documentId}` : `doc-${documentId}-retry-${run}`;
  }

  async enqueue(
    documentId: number,
    options: { priority: number; run?: number },
  ): Promise<void> {
    await this.queue.add(
      DocumentJobName.PROCESS,
      { documentId },
      {
        jobId: DocumentProcessQueueService.jobId(documentId, options.run),
        priority: options.priority,
      },
    );
  }

  /**
   * İsteğe bağlı üretim işi (hızlı tekrar, hafıza kancaları). `run`
   * benzersizdir; tamamlanmış eski bir iş yeni isteği gölgelemesin.
   */
  async enqueueStudy(
    name: typeof DocumentJobName.QUICK | typeof DocumentJobName.MNEMONICS,
    documentId: number,
    options: { priority: number; run: number },
  ): Promise<void> {
    const prefix = name === DocumentJobName.QUICK ? "quick" : "mnem";
    await this.queue.add(
      name,
      { documentId },
      { jobId: `${prefix}-${documentId}-${options.run}`, priority: options.priority },
    );
  }

  getQueue(): Queue<DocumentProcessJobData> {
    return this.queue;
  }
}
