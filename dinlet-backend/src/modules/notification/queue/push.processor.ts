import { Processor } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { BaseProcessor } from "#/infra/queue/base.processor.js";
import { QueueName } from "#/infra/queue/queue.constants.js";
import type { PushJobData } from "#/modules/notification/queue/push.types.js";
import { PushTokenRepository } from "#/modules/notification/repository/index.js";
import { ExpoPushService } from "#/modules/notification/services/expo-push.service.js";

/** Kullanıcının kayıtlı cihazlarına push gönderir; ölü token'ları siler. */
@Processor(QueueName.PUSH)
export class PushProcessor extends BaseProcessor<PushJobData> {
  protected readonly logger = new Logger(PushProcessor.name);

  constructor(
    private readonly pushTokenRepository: PushTokenRepository,
    private readonly expoPushService: ExpoPushService,
  ) {
    super();
  }

  async handle(job: Job<PushJobData>): Promise<void> {
    const tokens = await this.pushTokenRepository.findTokensByUser(
      job.data.userId,
    );
    if (tokens.length === 0) return;

    const invalid = await this.expoPushService.send(tokens, job.data.message);
    if (invalid.length > 0) {
      await this.pushTokenRepository.deleteTokens(invalid);
      this.logger.log(`${invalid.length} geçersiz push token silindi`);
    }
  }
}
