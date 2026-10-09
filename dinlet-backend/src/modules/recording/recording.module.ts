import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { Paginator } from "#/core/utils/paginator.js";
import { QueueName } from "#/infra/queue/queue.constants.js";
import { RecordingControllers } from "#/modules/recording/controllers/index.js";
import {
  RecordingMixQueueEvents,
  RecordingMixQueueService,
} from "#/modules/recording/queue/index.js";
import { RecordingRepositories } from "#/modules/recording/repository/index.js";
import { RecordingServices } from "#/modules/recording/services/index.js";

/**
 * Kendi sesinle kayıt ve ses tercihi. Birleştirme Python worker'da
 * (`tts` kuyruğu, `mix` işi). Oynatıcı tarafı (`GET /sections/:id`
 * içindeki `ownVoice`) belge modülünde bu tabloları okur.
 */
@Module({
  imports: [BullModule.registerQueue({ name: QueueName.TTS })],
  controllers: [...RecordingControllers],
  providers: [
    ...RecordingRepositories,
    ...RecordingServices,
    RecordingMixQueueService,
    RecordingMixQueueEvents,
    Paginator,
  ],
  exports: [...RecordingRepositories, ...RecordingServices],
})
export class RecordingModule {}
