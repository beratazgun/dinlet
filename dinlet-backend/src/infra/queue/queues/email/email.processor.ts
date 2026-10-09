import { Processor } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { NotificationsService } from "#/infra/notifications/index.js";
import { BaseProcessor } from "#/infra/queue/base.processor.js";
import { QueueName } from "#/infra/queue/queue.constants.js";
import type { EmailJobData } from "#/infra/queue/queues/email/email.types.js";

/**
 * E-posta kuyruğunun WORKER'ı. Job'u alır, `NotificationsService` ile gönderir.
 *
 * Sadece `handle`'ı uygular; başlangıç/bitiş logu, hata + retry/DLQ görünürlüğü
 * ve hatanın yeniden fırlatılması `BaseProcessor` tarafından yönetilir.
 */
@Processor(QueueName.EMAIL)
export class EmailProcessor extends BaseProcessor<EmailJobData> {
  protected readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async handle(job: Job<EmailJobData>): Promise<void> {
    const { to, code, variables } = job.data;
    const result = await this.notificationsService.sendEmailWithFallback({
      to,
      code,
      variables,
    });

    // Başarısızsa fırlat → BaseProcessor retry/DLQ'yu yönetir.
    if (!result.success) {
      throw new Error(result.error ?? "E-posta gönderimi başarısız oldu");
    }
  }
}
