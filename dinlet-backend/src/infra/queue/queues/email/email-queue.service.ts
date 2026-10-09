import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { QueueName } from "#/infra/queue/queue.constants.js";
import { EmailJobName } from "#/infra/queue/queues/email/email.constants.js";
import type { EmailJobData } from "#/infra/queue/queues/email/email.types.js";

/**
 * E-posta kuyruğunun PRODUCER'ı (üretici).
 *
 * Çağıran taraf e-postayı doğrudan göndermez; buraya bir job ekler. Asıl
 * gönderim `EmailProcessor` tarafından request dışında, retry/backoff ile yapılır.
 * Global module tarafından export edilir → her yerden enjekte edilebilir.
 */
@Injectable()
export class EmailQueueService {
  constructor(
    @InjectQueue(QueueName.EMAIL) private readonly queue: Queue<EmailJobData>,
  ) {}

  /** Bir e-posta gönderimini kuyruğa ekler (ortak retry/backoff uygulanır). */
  async enqueueEmail(data: EmailJobData): Promise<void> {
    await this.queue.add(EmailJobName.SEND, data);
  }
}
