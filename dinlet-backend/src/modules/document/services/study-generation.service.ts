import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvType } from "#config/env.validation.js";
import { AcceptedResponse, OkResponse } from "#/core/http/index.js";
import { mapWithConcurrency } from "#/core/utils/concurrency.util.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { LlmService } from "#/infra/llm/index.js";
import { ConsentService } from "#/modules/auth/services/consent.service.js";
import { UsageService } from "#/modules/billing/services/index.js";
import { fluentBlockReason } from "#/modules/billing/utils/index.js";
import type { TtsJobResult } from "#/modules/document/queue/document-queue.types.js";
import { DocumentJobName } from "#/modules/document/queue/document-queue.types.js";
import { DocumentProcessQueueService } from "#/modules/document/queue/document-process-queue.service.js";
import { TtsQueueService } from "#/modules/document/queue/tts-queue.service.js";
import {
  DocumentRepository,
  LlmUsageRepository,
  MnemonicRepository,
  SectionRepository,
} from "#/modules/document/repository/index.js";
import { DocumentPipelineService } from "#/modules/document/services/document-pipeline.service.js";
import {
  buildMnemonicUserContent,
  buildQuickUserContent,
  hashScript,
  MNEMONIC_SCHEMA,
  MNEMONIC_SYSTEM_PROMPT,
  parseMnemonics,
  parseQuickParagraphs,
  QUICK_SCHEMA,
  QUICK_SYSTEM_PROMPT,
} from "#/modules/document/utils/index.js";
import {
  DocumentStatus,
  GenerationStatus,
  SectionStatus,
} from "#database/enums.js";

const TTS_SAMPLE_RATE = 24_000;

/**
 * İsteğe bağlı çalışma araçları (Pro + yurt dışı aktarım rızası):
 * hızlı tekrar (kısa anlatım + ayrı ses) ve hafıza kancası önerileri.
 * LLM adımları `document-process` kuyruğunda çalışır; sesler `tts`'te.
 * Hata belgeyi değil yalnızca ilgili üretimi başarısız yapar.
 */
@Injectable()
export class StudyGenerationService {
  private readonly logger = new Logger(StudyGenerationService.name);
  private readonly llmConcurrency: number;

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly mnemonicRepository: MnemonicRepository,
    private readonly llmUsageRepository: LlmUsageRepository,
    private readonly llmService: LlmService,
    private readonly processQueue: DocumentProcessQueueService,
    private readonly ttsQueue: TtsQueueService,
    private readonly pipeline: DocumentPipelineService,
    private readonly usageService: UsageService,
    private readonly consentService: ConsentService,
    private readonly dateManager: DateManager,
    configService: ConfigService<EnvType>,
  ) {
    this.llmConcurrency = configService.getOrThrow("LLM_CONCURRENCY", {
      infer: true,
    });
  }

  // ---------------------------------------------------------------------
  // Hızlı tekrar
  // ---------------------------------------------------------------------

  /** Notun sesi hazır bölümleri için hızlı tekrar üretimini başlatır. */
  async requestQuick(
    documentId: number,
    userId: number,
  ): Promise<AcceptedResponse> {
    const document = await this.findReadyDocument(documentId, userId);
    await this.assertAllowed(userId, "Hızlı tekrar");

    const queued = await this.sectionRepository.markQuickPending(documentId);
    if (queued > 0) {
      await this.processQueue.enqueueStudy(DocumentJobName.QUICK, documentId, {
        priority: await this.pipeline.priorityFor(userId),
        run: this.run(),
      });
    }
    return new AcceptedResponse(
      queued > 0 ? "Hızlı tekrar hazırlanıyor" : "Hızlı tekrar zaten hazır",
      { documentId: document.id, queuedSections: queued },
    );
  }

  /** Kuyruk işi: bekleyen bölümlerin kısa anlatımı ve sesi. */
  async runQuick(documentId: number): Promise<void> {
    const document = await this.documentRepository.findForPipeline(documentId);
    if (!document || document.deletedAt) return;
    const sections = (
      await this.sectionRepository.findForQuick(documentId)
    ).filter(
      (section) =>
        section.quickStatus === GenerationStatus.PENDING && section.script,
    );
    const priority = await this.pipeline.priorityFor(document.userId);

    await mapWithConcurrency(sections, this.llmConcurrency, async (section) => {
      try {
        let quickScript = section.quickScript;
        if (!quickScript) {
          const result = await this.llmService.generateStructured({
            system: QUICK_SYSTEM_PROMPT,
            content: buildQuickUserContent(
              section.title,
              section.script!.paragraphs,
            ),
            schema: QUICK_SCHEMA,
          });
          for (const usage of result.usages) {
            await this.llmUsageRepository.record(usage, {
              documentId,
              sectionId: section.id,
            });
          }
          const paragraphs =
            result.kind === "ok" ? parseQuickParagraphs(result.data) : [];
          if (paragraphs.length === 0) {
            await this.sectionRepository.updateQuick(section.id, {
              quickStatus: GenerationStatus.FAILED,
            });
            return;
          }
          quickScript = { paragraphs, recap: null };
        }

        const quickHash = hashScript(quickScript);
        await this.sectionRepository.updateQuick(section.id, {
          quickScript,
          quickScriptHash: quickHash,
        });
        await this.ttsQueue.enqueueQuick(
          {
            sectionId: section.id,
            documentId,
            userId: document.userId,
            title: section.title,
            paragraphs: quickScript.paragraphs,
            recap: null,
            audioKey: `audio/${document.userId}/${document.id}-${document.storagePrefix}/${section.id}-${quickHash}-quick.mp3`,
            sampleRate: TTS_SAMPLE_RATE,
          },
          { quickHash, attempt: section.attempts, priority },
        );
      } catch (error) {
        this.logger.warn(
          `[Bölüm#${section.id}] Hızlı tekrar üretilemedi: ${error instanceof Error ? error.message : String(error)}`,
        );
        await this.sectionRepository.updateQuick(section.id, {
          quickStatus: GenerationStatus.FAILED,
        });
      }
    });
  }

  /** Hızlı tekrar sesi hazır; eski metne ait geç sonuçlar yok sayılır. */
  async completeQuick(
    sectionId: number,
    quickHash: string,
    result: TtsJobResult,
  ): Promise<void> {
    const section = await this.sectionRepository.findWithDocument(sectionId);
    if (!section?.document || section.document.deletedAt) return;
    if (!result.audioKey.endsWith(`-${quickHash}-quick.mp3`)) return;
    await this.sectionRepository.updateQuick(sectionId, {
      quickAudioKey: result.audioKey,
      quickDurationMs: result.durationMs,
      quickStatus: GenerationStatus.READY,
    });
  }

  async failQuick(sectionId: number): Promise<void> {
    await this.sectionRepository.updateQuick(sectionId, {
      quickStatus: GenerationStatus.FAILED,
    });
  }

  /** `quick` işinin tüm denemeleri tükendi: bekleyen bölümler başarısız. */
  async failQuickJob(documentId: number): Promise<void> {
    for (const section of await this.sectionRepository.findForQuick(
      documentId,
    )) {
      if (
        section.quickStatus === GenerationStatus.PENDING &&
        !section.quickScript
      ) {
        await this.failQuick(section.id);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Hafıza kancaları
  // ---------------------------------------------------------------------

  async listMnemonics(documentId: number, userId: number): Promise<OkResponse> {
    const document = await this.documentRepository.findOwnedForStudy(
      documentId,
      userId,
    );
    if (!document) throw new NotFoundException(`Not bulunamadı: ${documentId}`);
    return new OkResponse("Hafıza kancaları", {
      status: document.mnemonicStatus,
      items: await this.mnemonicRepository.listVisible(documentId),
    });
  }

  /** Öneri üretimini başlatır; saklanmış kancalar korunur. */
  async requestMnemonics(
    documentId: number,
    userId: number,
  ): Promise<AcceptedResponse> {
    const document = await this.findReadyDocument(documentId, userId);
    await this.assertAllowed(userId, "Hafıza kancaları");
    if (document.mnemonicStatus === GenerationStatus.PENDING) {
      throw new ConflictException("Öneriler zaten hazırlanıyor.");
    }
    await this.documentRepository.update(documentId, {
      mnemonicStatus: GenerationStatus.PENDING,
    });
    await this.processQueue.enqueueStudy(
      DocumentJobName.MNEMONICS,
      documentId,
      {
        priority: await this.pipeline.priorityFor(userId),
        run: this.run(),
      },
    );
    return new AcceptedResponse("Hafıza kancaları hazırlanıyor", {
      documentId,
    });
  }

  /** Kuyruk işi: notun anlatımından kanca önerileri. */
  async runMnemonics(documentId: number): Promise<void> {
    const document = await this.documentRepository.findForPipeline(documentId);
    if (!document || document.deletedAt) return;
    const sections = (
      await this.sectionRepository.findForQuick(documentId)
    ).filter(
      (section) => section.status === SectionStatus.READY && section.script,
    );

    const result = await this.llmService.generateStructured({
      system: MNEMONIC_SYSTEM_PROMPT,
      content: buildMnemonicUserContent(
        document.title,
        sections.map((section) => ({
          order: section.order,
          title: section.title,
          paragraphs: section.script!.paragraphs,
        })),
      ),
      schema: MNEMONIC_SCHEMA,
    });
    for (const usage of result.usages) {
      await this.llmUsageRepository.record(usage, {
        documentId,
        sectionId: null,
      });
    }
    if (result.kind !== "ok") {
      await this.failMnemonics(documentId);
      return;
    }

    const sectionByOrder = new Map(
      sections.map((section) => [section.order, section.id]),
    );
    await this.mnemonicRepository.replaceSuggestions(
      documentId,
      parseMnemonics(result.data).map((suggestion) => ({
        sectionId: sectionByOrder.get(suggestion.sectionOrder) ?? null,
        topic: suggestion.topic,
        hook: suggestion.hook,
        explanation: suggestion.explanation,
      })),
    );
    await this.documentRepository.update(documentId, {
      mnemonicStatus: GenerationStatus.READY,
    });
  }

  async failMnemonics(documentId: number): Promise<void> {
    await this.documentRepository.update(documentId, {
      mnemonicStatus: GenerationStatus.FAILED,
    });
  }

  /**
   * Sakla / kaldır. Saklanan kanca seslendirilir ve ait olduğu bölümün
   * sonunda okunur; kaldırılan listeden gizlenir.
   */
  async updateMnemonic(
    id: number,
    patch: { kept?: boolean; dismissed?: boolean },
    userId: number,
  ): Promise<OkResponse> {
    const mnemonic = await this.mnemonicRepository.findOwned(id, userId);
    if (!mnemonic)
      throw new NotFoundException(`Hafıza kancası bulunamadı: ${id}`);
    await this.mnemonicRepository.update(id, {
      kept: patch.kept ?? mnemonic.kept,
      dismissed: patch.dismissed ?? false,
    });

    if (patch.kept && !mnemonic.audioKey) {
      const { document } = mnemonic;
      await this.ttsQueue.enqueueMnemonic(
        id,
        {
          sectionId: mnemonic.sectionId ?? 0,
          documentId: document.id,
          userId: document.userId,
          title: "",
          paragraphs: [],
          recap: null,
          audioKey: "",
          sampleRate: TTS_SAMPLE_RATE,
          clipsOnly: true,
          clips: [
            {
              audioKey: `audio/${document.userId}/${document.id}-${document.storagePrefix}/mnemonic-${id}.mp3`,
              text: `Hafıza kancası. ${mnemonic.topic}. ${mnemonic.hook}. ${mnemonic.explanation}`,
            },
          ],
        },
        { run: this.run(), priority: await this.pipeline.priorityFor(userId) },
      );
    }
    return new OkResponse(
      patch.dismissed ? "Öneri kaldırıldı" : "Hafıza kancası güncellendi",
      await this.mnemonicRepository.findById(id),
    );
  }

  async completeMnemonicAudio(
    mnemonicId: number,
    result: TtsJobResult,
  ): Promise<void> {
    const clip = result.clips?.[0];
    if (!clip) return;
    await this.mnemonicRepository.update(mnemonicId, {
      audioKey: clip.audioKey,
      durationMs: clip.durationMs,
    });
  }

  // ---------------------------------------------------------------------

  private async findReadyDocument(documentId: number, userId: number) {
    const document = await this.documentRepository.findOwnedForStudy(
      documentId,
      userId,
    );
    if (!document) throw new NotFoundException(`Not bulunamadı: ${documentId}`);
    if (
      document.status !== DocumentStatus.READY &&
      document.status !== DocumentStatus.PARTIAL
    ) {
      throw new ConflictException(
        "Not henüz hazır değil; sesi hazır olunca tekrar dene.",
      );
    }
    return document;
  }

  /** LLM'li araçlar: Pro + yurt dışı aktarım rızası (403 ve nedeni). */
  private async assertAllowed(userId: number, feature: string): Promise<void> {
    const blockedBy = fluentBlockReason(
      await this.usageService.getPlanLimits(userId),
      await this.consentService.hasCrossBorderTransferConsent(userId),
    );
    if (blockedBy === "PLAN") {
      throw new ForbiddenException({
        message: `${feature} Dinlet Pro'ya özel.`,
        code: "PRO_REQUIRED",
      });
    }
    if (blockedBy === "CONSENT") {
      throw new ForbiddenException({
        message: `${feature} için notunun yurt dışındaki yapay zekâ servisine aktarılmasına rıza vermelisin.`,
        code: "CROSS_BORDER_CONSENT_REQUIRED",
      });
    }
  }

  /** Benzersiz iş numarası (tamamlanmış eski job aynı id'yi tutabilir). */
  private run(): number {
    return Math.floor(this.dateManager.utcNow().getTime() / 1_000);
  }
}
