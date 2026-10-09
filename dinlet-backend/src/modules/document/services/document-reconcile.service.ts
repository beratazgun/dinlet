import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";

import { DateManager } from "#/core/utils/date-manager.js";
import {
  DocumentProcessQueueService,
  ExtractQueueService,
  TtsQueueService,
  type ExtractJobResult,
  type TtsJobResult,
} from "#/modules/document/queue/index.js";
import {
  DocumentRepository,
  SectionRepository,
} from "#/modules/document/repository/index.js";
import { DocumentPipelineService } from "#/modules/document/services/document-pipeline.service.js";
import { DocumentStatus, SectionStatus } from "#database/enums.js";

const MINUTE_MS = 60_000;
/** Bir iş bu süreden uzun aynı durumda kaldıysa job durumu kontrol edilir. */
const DEFAULT_STALE_MINUTES = 15;
const BATCH_SIZE = 100;

export interface ReconcileSummary {
  checked: number;
  recovered: number;
}

/**
 * Kuyruk olaylarının kaçtığı durumları onarır (doküman §11 "kurtarma").
 *
 * `QueueEvents` Redis stream'inden okur; API kapalıyken tamamlanan işlerin
 * olayları kaçabilir, enqueue anında Redis erişilemez olabilir. Bu servis
 * uzun süre aynı durumda kalan belge/bölümlerin job'una bakar:
 * tamamlanmışsa sonucu uygular, kalıcı başarısızsa başarısızlığı uygular,
 * job hiç yoksa yeniden kuyruğa alır; bekliyor/çalışıyorsa dokunmaz.
 * Pipeline metotları idempotent olduğu için tekrar çalışmak güvenlidir.
 */
@Injectable()
export class DocumentReconcileService {
  private readonly logger = new Logger(DocumentReconcileService.name);

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly pipeline: DocumentPipelineService,
    private readonly extractQueue: ExtractQueueService,
    private readonly processQueue: DocumentProcessQueueService,
    private readonly ttsQueue: TtsQueueService,
    private readonly dateManager: DateManager,
  ) {}

  async reconcile(staleMinutes = DEFAULT_STALE_MINUTES): Promise<ReconcileSummary> {
    const cutoff = this.dateManager.toISOString(
      this.dateManager.addMilliseconds(-staleMinutes * MINUTE_MS),
    );
    const summary: ReconcileSummary = { checked: 0, recovered: 0 };

    const extracting = await this.documentRepository.findStale(
      [DocumentStatus.QUEUED, DocumentStatus.EXTRACTING],
      cutoff,
      BATCH_SIZE,
    );
    for (const document of extracting) {
      summary.checked++;
      if (await this.reconcileExtraction(document.id)) summary.recovered++;
    }

    const scripting = await this.documentRepository.findStale(
      [DocumentStatus.SCRIPTING],
      cutoff,
      BATCH_SIZE,
    );
    for (const document of scripting) {
      summary.checked++;
      if (await this.reconcileProcessing(document.id)) summary.recovered++;
    }

    const synthesizing = await this.sectionRepository.findStale(
      SectionStatus.SYNTHESIZING,
      cutoff,
      BATCH_SIZE,
    );
    for (const section of synthesizing) {
      summary.checked++;
      if (await this.reconcileSynthesis(section)) summary.recovered++;
    }

    if (summary.recovered > 0) {
      this.logger.warn(
        `Uzlaştırma: ${summary.checked} kayıt kontrol edildi, ${summary.recovered} onarıldı`,
      );
    }
    return summary;
  }

  private async reconcileExtraction(documentId: number): Promise<boolean> {
    const job = await this.findJob(
      this.extractQueue.getQueue(),
      ExtractQueueService.jobId(documentId),
    );
    if (!job) {
      await this.pipeline.startExtraction(documentId);
      return true;
    }
    if (job.state === "completed") {
      await this.pipeline.completeExtraction(
        documentId,
        job.returnvalue as ExtractJobResult,
      );
      return true;
    }
    if (job.state === "failed") {
      await this.pipeline.failExtraction(documentId, job.failedReason);
      return true;
    }
    return false;
  }

  /** `SCRIPTING`'de takılı belge: aktif işleme job'u yoksa yeniden kuyruğa al. */
  private async reconcileProcessing(documentId: number): Promise<boolean> {
    const queue = this.processQueue.getQueue();
    const jobs = await queue.getJobs(["active", "waiting", "delayed", "prioritized"]);
    if (jobs.some((job) => job?.data.documentId === documentId)) return false;

    await this.processQueue.enqueue(documentId, {
      priority: await this.pipeline.priorityFor(
        (await this.documentRepository.findForPipeline(documentId))!.userId,
      ),
      // Önceki job'lar (tamamlanmış/başarısız) aynı id'yi tutuyor olabilir.
      run: Math.floor(this.dateManager.utcNow().getTime() / 1_000),
    });
    return true;
  }

  private async reconcileSynthesis(section: {
    id: number;
    scriptHash: string | null;
    attempts: number;
  }): Promise<boolean> {
    if (!section.scriptHash) return false;
    const job = await this.findJob(
      this.ttsQueue.getQueue(),
      TtsQueueService.jobId(section.id, section.scriptHash, section.attempts),
    );
    if (!job) {
      await this.pipeline.resubmitSynthesis(section.id);
      return true;
    }
    if (job.state === "completed") {
      await this.pipeline.completeSynthesis(
        section.id,
        job.returnvalue as TtsJobResult,
      );
      return true;
    }
    if (job.state === "failed") {
      await this.pipeline.failSynthesis(
        section.id,
        section.scriptHash,
        job.failedReason,
      );
      return true;
    }
    return false;
  }

  private async findJob(queue: Queue, jobId: string) {
    const job = await queue.getJob(jobId);
    if (!job) return null;
    return {
      state: await job.getState(),
      returnvalue: job.returnvalue as unknown,
      failedReason: job.failedReason ?? "bilinmeyen hata",
    };
  }
}
