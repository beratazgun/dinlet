import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { EnvType } from "#config/env.validation.js";
import { mapWithConcurrency } from "#/core/utils/concurrency.util.js";
import { S3Service } from "#/infra/s3/s3.service.js";
import { UsageService } from "#/modules/billing/services/index.js";
import {
  DOCUMENT_FAILED_EVENT,
  DOCUMENT_PROGRESS_EVENT,
  DOCUMENT_READY_EVENT,
  DocumentFailedEvent,
  DocumentProgressEvent,
  DocumentReadyEvent,
} from "#/modules/document/event/document.events.js";
import type {
  ExtractJobResult,
  TtsJobData,
  TtsJobResult,
} from "#/modules/document/queue/document-queue.types.js";
import { DocumentProcessQueueService } from "#/modules/document/queue/document-process-queue.service.js";
import { ExtractQueueService } from "#/modules/document/queue/extract-queue.service.js";
import { TtsQueueService } from "#/modules/document/queue/tts-queue.service.js";
import {
  DocumentRepository,
  SectionRepository,
} from "#/modules/document/repository/index.js";
import { NarrationService } from "#/modules/document/services/narration.service.js";
import type { SectionScript } from "#/modules/document/types/index.js";
import {
  buildRawScript,
  computeProgress,
  hashScript,
  planStudyClips,
  resolveFinalStatus,
  splitMarkdownIntoSections,
} from "#/modules/document/utils/index.js";
import {
  DocumentStatus,
  RewriteMode,
  SectionStatus,
} from "#database/enums.js";

/** Sayfa başına bundan az karakter çıkarıldıysa PDF okunamamış sayılır. */
const MIN_CHARS_PER_PAGE = 100;
/** OCR'lanan sayfa oranı bunu aşarsa çıkarma kalitesi `LOW`. */
const LOW_QUALITY_OCR_RATIO = 0.5;
/** TTS çıkış örnekleme hızı (Hz); worker 24 kHz PCM'den MP3 üretir. */
const TTS_SAMPLE_RATE = 24_000;

const UNREADABLE_PDF_REASON =
  "PDF okunamadı. Metin içermeyen veya çok düşük kaliteli taranmış bir dosya olabilir.";

type PipelineDocument = NonNullable<
  Awaited<ReturnType<DocumentRepository["findForPipeline"]>>
>;
type ProcessingSection = Awaited<
  ReturnType<SectionRepository["findForProcessing"]>
>[number];

/**
 * Belge işleme hattının durum makinesi (doküman §4).
 *
 * `QUEUED` → (extract, Python) `EXTRACTING` → (document-process, NestJS)
 * `SCRIPTING` → (tts, Python) `SYNTHESIZING` → `READY` / `PARTIAL` / `FAILED`.
 *
 * Kuyruk olayları tekrar veya geç gelebilir; her geçiş beklenen kaynak
 * durumu koşul olarak verir (`transition`), böylece metotlar idempotenttir.
 * Hem `QueueEvents` dinleyicileri hem de uzlaştırıcı (reconcile) aynı
 * metotları çağırır.
 */
@Injectable()
export class DocumentPipelineService {
  private readonly logger = new Logger(DocumentPipelineService.name);
  private readonly llmConcurrency: number;

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly extractQueue: ExtractQueueService,
    private readonly processQueue: DocumentProcessQueueService,
    private readonly ttsQueue: TtsQueueService,
    private readonly narrationService: NarrationService,
    private readonly usageService: UsageService,
    private readonly s3Service: S3Service,
    private readonly eventEmitter: EventEmitter2,
    configService: ConfigService<EnvType>,
  ) {
    this.llmConcurrency = configService.getOrThrow("LLM_CONCURRENCY", {
      infer: true,
    });
  }

  // ---------------------------------------------------------------------
  // 1. Metin çıkarma (extract — Python worker)
  // ---------------------------------------------------------------------

  /**
   * Belgenin PDF'ini metin çıkarma kuyruğuna alır. `EXTRACTING` de kabul
   * edilir: job'u kaybolmuş belge uzlaştırıcıyla yeniden kuyruğa girer
   * (aynı jobId mevcutsa BullMQ yeni job eklemez).
   */
  async startExtraction(documentId: number): Promise<void> {
    const document = await this.documentRepository.findForPipeline(documentId);
    if (!document || document.deletedAt) return;
    if (
      document.status !== DocumentStatus.QUEUED &&
      document.status !== DocumentStatus.EXTRACTING
    ) {
      return;
    }
    if (!document.media) {
      await this.failDocument(document, "Belgenin PDF dosyası bulunamadı.");
      return;
    }

    this.logger.log(
      `📄 [Belge#${documentId}] Metin çıkarma kuyruğuna alındı (pdf: ${document.media.storageKey}, sayfa: ${document.pageCount})`,
    );

    await this.extractQueue.enqueue(
      {
        documentId,
        pdfKey: document.media.storageKey,
        extractedKey: `extracted/${documentId}-${document.storagePrefix}.md`,
        pageCount: document.pageCount,
      },
      await this.priorityFor(document.userId),
    );
  }

  /** Worker job'u aldı. */
  async markExtracting(documentId: number): Promise<void> {
    const changed = await this.documentRepository.transition(
      documentId,
      [DocumentStatus.QUEUED],
      { status: DocumentStatus.EXTRACTING },
    );
    if (changed) {
      this.logger.log(`⚙️ [Belge#${documentId}] Metin çıkarma başladı (EXTRACTING)`);
      await this.emitProgress(documentId);
    }
  }

  /**
   * Markdown hazır: okunabilirlik kontrolünden geçerse belge `SCRIPTING`
   * olur ve bölümleme (`document-process`) kuyruğa alınır.
   */
  async completeExtraction(
    documentId: number,
    result: ExtractJobResult,
  ): Promise<void> {
    const document = await this.documentRepository.findForPipeline(documentId);
    if (!document || document.deletedAt) return;
    if (
      document.status !== DocumentStatus.QUEUED &&
      document.status !== DocumentStatus.EXTRACTING
    ) {
      return;
    }

    if (result.chars < document.pageCount * MIN_CHARS_PER_PAGE) {
      this.logger.warn(
        `⚠️ [Belge#${documentId}] Çıkarılan metin çok kısa (${result.chars} karakter < ${document.pageCount * MIN_CHARS_PER_PAGE} eşiği)`,
      );
      await this.failDocument(document, UNREADABLE_PDF_REASON);
      return;
    }

    const isLowQuality =
      result.ocrPages / Math.max(1, document.pageCount) > LOW_QUALITY_OCR_RATIO;
    const changed = await this.documentRepository.transition(
      documentId,
      [DocumentStatus.QUEUED, DocumentStatus.EXTRACTING],
      {
        status: DocumentStatus.SCRIPTING,
        extractedKey: result.extractedKey,
        extractQuality: isLowQuality ? "LOW" : "OK",
      },
    );
    if (!changed) return;

    this.logger.log(
      `✅ [Belge#${documentId}] Metin çıkarıldı: ${result.chars} karakter, ${result.ocrPages} OCR sayfa, kalite: ${isLowQuality ? "DÜŞÜK" : "İYİ"}. Anlatım aşamasına (SCRIPTING) geçiliyor.`,
    );

    await this.processQueue.enqueue(documentId, {
      priority: await this.priorityFor(document.userId),
    });
    await this.emitProgress(documentId);
  }

  /** Metin çıkarma tüm denemelerde başarısız oldu. */
  async failExtraction(documentId: number, reason: string): Promise<void> {
    const document = await this.documentRepository.findForPipeline(documentId);
    if (!document || document.deletedAt) return;
    this.logger.warn(`❌ [Belge#${documentId}] Metin çıkarılamadı: ${reason}`);
    await this.failDocument(document, UNREADABLE_PDF_REASON, [
      DocumentStatus.QUEUED,
      DocumentStatus.EXTRACTING,
    ]);
  }

  // ---------------------------------------------------------------------
  // 2. Bölümleme + anlatım (document-process — NestJS)
  // ---------------------------------------------------------------------

  /**
   * Markdown'ı bölümlere ayırır (ilk çalıştırmada), sonra metni hazır
   * olmayan her bölüm için anlatımı üretir ve hemen seslendirmeye gönderir.
   * Yeniden çalıştırmada kaldığı yerden devam eder: var olan bölümler
   * yeniden oluşturulmaz, metni hazır bölümler için LLM tekrar çağrılmaz.
   */
  async processDocument(documentId: number): Promise<void> {
    const document = await this.documentRepository.findForPipeline(documentId);
    if (!document || document.deletedAt) return;
    if (
      document.status !== DocumentStatus.SCRIPTING &&
      document.status !== DocumentStatus.SYNTHESIZING
    ) {
      return;
    }

    this.logger.log(`📝 [Belge#${documentId}] Belge işleniyor (bölümleme ve anlatım)...`);

    let sections = await this.sectionRepository.findForProcessing(documentId);
    if (sections.length === 0) {
      sections = await this.createSections(document);
      if (sections.length === 0) {
        this.logger.warn(`⚠️ [Belge#${documentId}] Bölümlere ayrılamadı`);
        await this.failDocument(document, UNREADABLE_PDF_REASON);
        return;
      }
      this.logger.log(`📑 [Belge#${documentId}] ${sections.length} bölüme ayrıldı`);
      await this.emitProgress(documentId);
    }

    const priority = await this.priorityFor(document.userId);
    const pending = sections.filter(
      (section) =>
        section.status === SectionStatus.PENDING ||
        section.status === SectionStatus.SCRIPTING ||
        section.status === SectionStatus.SCRIPTED,
    );
    const concurrency =
      document.rewriteMode === RewriteMode.FLUENT ? this.llmConcurrency : 1;

    const results = await mapWithConcurrency(pending, concurrency, (section) =>
      this.prepareSection(document, section, priority),
    );
    const failure = results.find((result) => result.status === "rejected");
    if (failure) {
      // Kuyruk/DB hatası: job yeniden denensin; hazırlanan bölümler korunur.
      throw failure.reason;
    }

    await this.documentRepository.transition(
      documentId,
      [DocumentStatus.SCRIPTING],
      { status: DocumentStatus.SYNTHESIZING },
    );
    await this.settleDocument(documentId);
  }

  /** `document-process` tüm denemelerde başarısız oldu. */
  async failProcessing(documentId: number, reason: string): Promise<void> {
    const document = await this.documentRepository.findForPipeline(documentId);
    if (!document || document.deletedAt) return;
    this.logger.error(`❌ [Belge#${documentId}] Belge işleme başarısız: ${reason}`);

    const sections = await this.sectionRepository.findSummariesByDocument(
      documentId,
    );
    if (sections.some((section) => section.status !== SectionStatus.PENDING)) {
      // Bazı bölümler zaten seslendirmede: metni hazır olanlar seslendirmeye
      // gönderilir, metni hazırlanamayanlar başarısız sayılır; belge hazır
      // bölümleriyle PARTIAL olarak sonuçlanır.
      for (const section of sections) {
        if (section.status === SectionStatus.SCRIPTED) {
          await this.resubmitSynthesis(section.id);
          await this.sectionRepository.update(section.id, {
            status: SectionStatus.SYNTHESIZING,
          });
          continue;
        }
        await this.sectionRepository.transition(
          section.id,
          [SectionStatus.PENDING, SectionStatus.SCRIPTING],
          {
            status: SectionStatus.FAILED,
            failureReason: "Bölüm metni hazırlanamadı.",
          },
        );
      }
      await this.settleDocument(documentId);
      return;
    }

    await this.failDocument(document, "Not işlenirken bir hata oluştu.", [
      DocumentStatus.SCRIPTING,
      DocumentStatus.SYNTHESIZING,
    ]);
  }

  private async createSections(
    document: PipelineDocument,
  ): Promise<ProcessingSection[]> {
    if (!document.extractedKey) {
      throw new Error(`Belge#${document.id} için çıkarılmış metin anahtarı yok`);
    }
    const markdown = await this.s3Service.getFileBuffer(document.extractedKey);
    if (!markdown) {
      throw new Error(`Çıkarılmış metin okunamadı: ${document.extractedKey}`);
    }

    const split = splitMarkdownIntoSections(markdown.toString("utf8"));
    if (split.length === 0) return [];

    await this.sectionRepository.createForDocument(
      document.id,
      split.map((section, index) => ({
        order: index + 1,
        title: section.title,
        sourceText: section.text,
        charCount: section.text.length,
      })),
    );
    return this.sectionRepository.findForProcessing(document.id);
  }

  /**
   * Bölümün metnini hazırlar (yoksa) ve seslendirme kuyruğuna gönderir.
   * Hazır metin (yeniden deneme) tekrar üretilmez.
   */
  private async prepareSection(
    document: PipelineDocument,
    section: ProcessingSection,
    priority: number,
  ): Promise<void> {
    let script = section.script;
    let scriptHash = section.scriptHash;

    if (!script || !scriptHash) {
      await this.sectionRepository.update(section.id, {
        status: SectionStatus.SCRIPTING,
      });
      this.logger.log(
        `🎤 [Belge#${document.id} | Bölüm#${section.id}] Metin/anlatım hazırlanıyor (başlık: "${section.title}", mod: ${document.rewriteMode})...`,
      );
      const prepared = await this.buildScript(document, section);
      if (prepared.script.paragraphs.length === 0) {
        this.logger.warn(
          `⚠️ [Belge#${document.id} | Bölüm#${section.id}] Seslendirilecek paragraf bulunamadı`,
        );
        await this.sectionRepository.update(section.id, {
          status: SectionStatus.FAILED,
          failureReason: "Bölümde seslendirilecek metin yok.",
        });
        return;
      }
      script = prepared.script;
      scriptHash = hashScript(script);
      await this.sectionRepository.update(section.id, {
        status: SectionStatus.SCRIPTED,
        script,
        scriptHash,
        model: prepared.model,
        promptVersion: prepared.promptVersion,
      });
    }

    this.logger.log(
      `🎙️ [Belge#${document.id} | Bölüm#${section.id}] Seslendirme (TTS) kuyruğuna alındı (${script.paragraphs.length} paragraf)`,
    );

    await this.ttsQueue.enqueue(
      this.ttsJob(document, section.id, section.title, script, scriptHash),
      { scriptHash, attempt: section.attempts, priority },
    );
    await this.sectionRepository.update(section.id, {
      status: SectionStatus.SYNTHESIZING,
    });
  }

  /** Pro: LLM ile akıcı anlatım; Free veya LLM başarısızsa kural tabanlı. */
  private async buildScript(
    document: PipelineDocument,
    section: ProcessingSection,
  ): Promise<{
    script: SectionScript;
    model: string | null;
    promptVersion: string | null;
  }> {
    if (
      document.rewriteMode === RewriteMode.FLUENT &&
      this.narrationService.isAvailable
    ) {
      const narration = await this.narrationService.narrate(
        { documentId: document.id, sectionId: section.id, title: section.title },
        section.sourceText,
      );
      if (narration) return narration;
    }
    return {
      script: buildRawScript(section.sourceText),
      model: null,
      promptVersion: null,
    };
  }

  // ---------------------------------------------------------------------
  // 3. Seslendirme (tts — Python worker)
  // ---------------------------------------------------------------------

  /** Bölümün sesi hazır. Eski bir metne ait geç sonuçlar yok sayılır. */
  async completeSynthesis(
    sectionId: number,
    result: TtsJobResult,
  ): Promise<void> {
    const section = await this.sectionRepository.findWithDocument(sectionId);
    if (!section?.document || section.document.deletedAt) return;
    if (
      !section.scriptHash ||
      !result.audioKey.endsWith(`-${section.scriptHash}.mp3`)
    ) {
      return;
    }

    const changed = await this.sectionRepository.transition(
      sectionId,
      [SectionStatus.SCRIPTED, SectionStatus.SYNTHESIZING],
      {
        status: SectionStatus.READY,
        audioKey: result.audioKey,
        durationMs: result.durationMs,
        sizeBytes: result.sizeBytes,
        failureReason: null,
      },
    );
    if (changed) {
      this.logger.log(
        `✅ [Bölüm#${sectionId}] Seslendirme tamamlandı: ${(result.durationMs / 1000).toFixed(1)} sn (${result.sizeBytes} bayt)`,
      );
      await this.saveStudyClips(sectionId, section.script, result);
      await this.settleDocument(section.document.id);
    }
  }

  /**
   * Sorulu bölümün özet, soru ve cevap seslerini kaydeder. Worker bir klibi
   * döndürmediyse o bölümün soruları yazılmaz (eksik sesle soru sorulmaz);
   * bölüm sesi yine de hazırdır.
   */
  private async saveStudyClips(
    sectionId: number,
    script: SectionScript | null,
    result: TtsJobResult,
  ): Promise<void> {
    if (!script?.questions?.length) return;
    const plan = planStudyClips(result.audioKey, script);
    const durations = new Map(
      (result.clips ?? []).map((clip) => [clip.audioKey, clip.durationMs]),
    );

    const questions = plan.questions.flatMap((keys, index) => {
      const item = script.questions![index]!;
      const questionDurationMs = durations.get(keys.questionKey);
      const answerDurationMs = durations.get(keys.answerKey);
      if (questionDurationMs === undefined || answerDurationMs === undefined) {
        return [];
      }
      return [
        {
          order: index + 1,
          question: item.question,
          answer: item.answer,
          detail: item.detail,
          questionAudioKey: keys.questionKey,
          questionDurationMs,
          answerAudioKey: keys.answerKey,
          answerDurationMs,
        },
      ];
    });
    if (questions.length < plan.questions.length) {
      this.logger.warn(
        `⚠️ [Bölüm#${sectionId}] Soru sesleri eksik döndü; bölümün soruları kaydedilmedi`,
      );
      return;
    }
    const recapDurationMs = plan.recapKey ? durations.get(plan.recapKey) : undefined;
    await this.sectionRepository.saveStudyClips(
      sectionId,
      plan.recapKey && recapDurationMs !== undefined
        ? { audioKey: plan.recapKey, durationMs: recapDurationMs }
        : null,
      questions,
    );
  }

  /** Bölümün sesi tüm denemelerde üretilemedi. */
  async failSynthesis(
    sectionId: number,
    scriptHash: string,
    reason: string,
  ): Promise<void> {
    const section = await this.sectionRepository.findWithDocument(sectionId);
    if (!section?.document || section.document.deletedAt) return;
    if (section.scriptHash !== scriptHash) return;

    this.logger.warn(`❌ [Bölüm#${sectionId}] Seslendirilemedi: ${reason}`);
    const changed = await this.sectionRepository.transition(
      sectionId,
      [SectionStatus.SCRIPTED, SectionStatus.SYNTHESIZING],
      {
        status: SectionStatus.FAILED,
        failureReason: "Bölümün sesi üretilemedi.",
      },
    );
    if (changed) await this.settleDocument(section.document.id);
  }

  /** Bölümü (metni varsa aynısıyla) seslendirme kuyruğuna yeniden gönderir. */
  async resubmitSynthesis(sectionId: number): Promise<void> {
    const section = await this.sectionRepository.findWithDocument(sectionId);
    if (!section?.document || section.document.deletedAt) return;
    if (!section.script || !section.scriptHash) return;

    await this.ttsQueue.enqueue(
      this.ttsJob(
        section.document,
        sectionId,
        section.title,
        section.script,
        section.scriptHash,
      ),
      {
        scriptHash: section.scriptHash,
        attempt: section.attempts,
        priority: await this.priorityFor(section.document.userId),
      },
    );
  }

  // ---------------------------------------------------------------------
  // Ortak
  // ---------------------------------------------------------------------

  /**
   * Tüm bölümler sonuçlandıysa belgenin son durumunu yazar ve bildirim
   * olayını yayınlar; sonuçlanmadıysa yalnızca ilerleme yayınlanır.
   */
  async settleDocument(documentId: number): Promise<void> {
    const sections = await this.sectionRepository.findSummariesByDocument(
      documentId,
    );
    const finalStatus = resolveFinalStatus(sections);
    if (!finalStatus) {
      await this.emitProgress(documentId);
      return;
    }

    const document = await this.documentRepository.findForPipeline(documentId);
    if (!document || document.deletedAt) return;

    if (finalStatus === DocumentStatus.FAILED) {
      this.logger.warn(`⚠️ [Belge#${documentId}] Notun hiçbir bölümü seslendirilemedi`);
      await this.failDocument(document, "Notun hiçbir bölümü seslendirilemedi.", [
        DocumentStatus.SCRIPTING,
        DocumentStatus.SYNTHESIZING,
        DocumentStatus.PARTIAL,
      ]);
      return;
    }

    const totalDurationMs = sections.reduce(
      (sum, section) => sum + (section.durationMs ?? 0),
      0,
    );
    const changed = await this.documentRepository.transition(
      documentId,
      [
        DocumentStatus.SCRIPTING,
        DocumentStatus.SYNTHESIZING,
        DocumentStatus.PARTIAL,
      ],
      { status: finalStatus, totalDurationMs, failureReason: null },
    );
    if (!changed) return;

    this.logger.log(
      `🎉 [Belge#${documentId}] İşlem tamamlandı: durum=${finalStatus}, toplam süre=${(totalDurationMs / 1000).toFixed(1)} sn`,
    );

    await this.emitProgress(documentId);
    this.eventEmitter.emit(
      DOCUMENT_READY_EVENT,
      new DocumentReadyEvent(
        document.userId,
        documentId,
        document.title,
        finalStatus === DocumentStatus.PARTIAL,
      ),
    );
  }

  /** Belgeyi `FAILED` yapar, kotayı iade eder ve olayı yayınlar. */
  private async failDocument(
    document: PipelineDocument,
    reason: string,
    from: DocumentStatus[] = [
      DocumentStatus.QUEUED,
      DocumentStatus.EXTRACTING,
      DocumentStatus.SCRIPTING,
      DocumentStatus.SYNTHESIZING,
    ],
  ): Promise<void> {
    this.logger.warn(`⚠️ [Belge#${document.id}] Belge FAILED durumuna geçiyor: ${reason}`);
    const changed = await this.documentRepository.transition(document.id, from, {
      status: DocumentStatus.FAILED,
      failureReason: reason,
    });
    if (!changed) return;

    await this.usageService.refundDocument(document.userId, document.id);
    await this.emitProgress(document.id);
    this.eventEmitter.emit(
      DOCUMENT_FAILED_EVENT,
      new DocumentFailedEvent(
        document.userId,
        document.id,
        document.title,
        reason,
      ),
    );
  }

  async emitProgress(documentId: number): Promise<void> {
    const document = await this.documentRepository.findForPipeline(documentId);
    if (!document || document.deletedAt) return;
    const sections = await this.sectionRepository.findSummariesByDocument(
      documentId,
    );
    const progress = computeProgress(document.status, sections);
    this.eventEmitter.emit(
      DOCUMENT_PROGRESS_EVENT,
      new DocumentProgressEvent(
        document.userId,
        documentId,
        document.status,
        progress.percent,
        progress.readySectionIds,
      ),
    );
  }

  /** Kuyruk önceliği kullanıcının şu anki planına göre (Pro önce). */
  async priorityFor(userId: number): Promise<number> {
    return (await this.usageService.getPlanLimits(userId)).queuePriority;
  }

  /** Bölümün TTS işi; sorulu bölümde özet/soru/cevap klipleriyle. */
  private ttsJob(
    document: { id: number; userId: number; storagePrefix: string },
    sectionId: number,
    title: string,
    script: SectionScript,
    scriptHash: string,
  ): TtsJobData {
    const audioKey = this.audioKey(document, sectionId, scriptHash);
    const { clips } = planStudyClips(audioKey, script);
    return {
      sectionId,
      documentId: document.id,
      userId: document.userId,
      title,
      paragraphs: script.paragraphs,
      recap: script.recap,
      audioKey,
      sampleRate: TTS_SAMPLE_RATE,
      ...(clips.length > 0 ? { clips } : {}),
    };
  }

  /**
   * MP3 anahtarı: tahmin edilemez belge öneki + metin özeti. Metin
   * değişirse anahtar da değişir (CDN'de `immutable` önbellek).
   */
  private audioKey(
    document: { id: number; userId: number; storagePrefix: string },
    sectionId: number,
    scriptHash: string,
  ): string {
    return `audio/${document.userId}/${document.id}-${document.storagePrefix}/${sectionId}-${scriptHash}.mp3`;
  }
}
