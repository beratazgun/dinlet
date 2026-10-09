import { OnWorkerEvent, Processor } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { BaseProcessor } from "#/infra/queue/base.processor.js";
import { QueueName } from "#/infra/queue/queue.constants.js";
import {
  DocumentJobName,
  type DocumentProcessJobData,
} from "#/modules/document/queue/document-queue.types.js";
import { DocumentPipelineService } from "#/modules/document/services/document-pipeline.service.js";
import { StudyGenerationService } from "#/modules/document/services/study-generation.service.js";

/**
 * Bölümleme + anlatım worker'ı. LLM çağrıları uzun sürebildiği için birden
 * fazla belge paralel işlenir; bölüm içi paralellik `LLM_CONCURRENCY` ile.
 */
@Processor(QueueName.DOCUMENT_PROCESS, { concurrency: 2 })
export class DocumentProcessProcessor extends BaseProcessor<DocumentProcessJobData> {
  protected readonly logger = new Logger(DocumentProcessProcessor.name);

  constructor(
    private readonly pipeline: DocumentPipelineService,
    private readonly studyGeneration: StudyGenerationService,
  ) {
    super();
  }

  async handle(job: Job<DocumentProcessJobData>): Promise<void> {
    this.logger.log(
      `⚙️ [Kuyruk:document-process] Job#${job.id} işleniyor (belge#${job.data.documentId})`,
    );
    if (job.name === DocumentJobName.QUICK) {
      await this.studyGeneration.runQuick(job.data.documentId);
    } else if (job.name === DocumentJobName.MNEMONICS) {
      await this.studyGeneration.runMnemonics(job.data.documentId);
    } else {
      await this.pipeline.processDocument(job.data.documentId);
    }
    this.logger.log(
      `✅ [Kuyruk:document-process] Job#${job.id} tamamlandı (belge#${job.data.documentId})`,
    );
  }

  /** Tüm denemeler tükendiyse belge (veya kalan bölümleri) başarısız sayılır. */
  @OnWorkerEvent("failed")
  async onFailed(job: Job<DocumentProcessJobData>, error: Error): Promise<void> {
    this.logger.warn(
      `❌ [Kuyruk:document-process] Job#${job.id} hata verdi (belge#${job.data.documentId}): ${error.message} (deneme: ${job.attemptsMade})`,
    );
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    // İsteğe bağlı üretim başarısızsa yalnızca o üretim başarısız sayılır;
    // not ve sesi etkilenmez.
    const fail =
      job.name === DocumentJobName.QUICK
        ? this.studyGeneration.failQuickJob(job.data.documentId)
        : job.name === DocumentJobName.MNEMONICS
          ? this.studyGeneration.failMnemonics(job.data.documentId)
          : this.pipeline.failProcessing(job.data.documentId, error.message);
    await fail
      .catch((cause: unknown) =>
        this.logger.error(`Başarısızlık kaydedilemedi: ${String(cause)}`),
      );
  }
}
