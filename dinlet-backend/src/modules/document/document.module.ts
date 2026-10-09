import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { DateManager } from "#/core/utils/date-manager.js";
import { Paginator } from "#/core/utils/paginator.js";
import {
  DEFAULT_JOB_OPTIONS,
  QueueName,
} from "#/infra/queue/queue.constants.js";
import { AuthModule } from "#/modules/auth/auth.module.js";
import { BillingModule } from "#/modules/billing/billing.module.js";
import { DocumentControllers } from "#/modules/document/controllers/index.js";
import { DocumentEventHandler } from "#/modules/document/event/document.event-handler.js";
import {
  DocumentProcessProcessor,
  DocumentProcessQueueService,
  ExtractQueueEvents,
  ExtractQueueService,
  TtsQueueEvents,
  TtsQueueService,
} from "#/modules/document/queue/index.js";
import { DocumentRepositories } from "#/modules/document/repository/index.js";
import { DocumentServices } from "#/modules/document/services/index.js";
import { MediaModule } from "#/modules/media/media.module.js";
import { StudyModule } from "#/modules/study/study.module.js";

/**
 * Python worker'ın tükettiği kuyruklarda sonuçlar uzlaştırıcının okuyabilmesi
 * için 24 saat tutulur (varsayılan 1 saat).
 */
const WORKER_QUEUE_OPTIONS = {
  defaultJobOptions: {
    ...DEFAULT_JOB_OPTIONS,
    removeOnComplete: { age: 24 * 3_600 },
  },
};

const DocumentQueues = [
  ExtractQueueService,
  DocumentProcessQueueService,
  TtsQueueService,
  DocumentProcessProcessor,
  ExtractQueueEvents,
  TtsQueueEvents,
];

/**
 * Notlar ve işleme hattı (doküman §4): PDF → (extract, Python) Markdown →
 * (document-process) bölümler + anlatım → (tts, Python) MP3.
 */
@Module({
  imports: [
    AuthModule,
    BillingModule,
    MediaModule,
    StudyModule,
    BullModule.registerQueue(
      { name: QueueName.EXTRACT, ...WORKER_QUEUE_OPTIONS },
      { name: QueueName.DOCUMENT_PROCESS },
      { name: QueueName.TTS, ...WORKER_QUEUE_OPTIONS },
    ),
  ],
  controllers: [...DocumentControllers],
  providers: [
    ...DocumentRepositories,
    ...DocumentServices,
    ...DocumentQueues,
    DocumentEventHandler,
    DateManager,
    Paginator,
  ],
  exports: [...DocumentRepositories, ...DocumentServices],
})
export class DocumentModule {}
