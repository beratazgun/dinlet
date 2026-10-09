import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { nanoid } from "nanoid";

import {
  AcceptedResponse,
  CreatedResponse,
  NoContentResponse,
  OkResponse,
} from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { Paginator } from "#/core/utils/paginator.js";
import { RedisQuotaLockHelper } from "#/infra/redis/helpers/redis-quota-lock.helper.js";
import { S3Service } from "#/infra/s3/s3.service.js";
import { UsageService } from "#/modules/billing/services/index.js";
import {
  fluentBlockReason,
  PLAN_LIMITS,
  type PlanLimits,
} from "#/modules/billing/utils/index.js";
import {
  DOCUMENT_GROUPS,
  type CreateDocumentBodyDto,
  type DocumentListQueryDto,
  type DocumentPreflightBodyDto,
  type FluentBlockReason,
  type UpdateDocumentBodyDto,
} from "#/modules/document/dtos/index.js";
import {
  DOCUMENT_CREATED_EVENT,
  DocumentCreatedEvent,
} from "#/modules/document/event/document.events.js";
import { DocumentProcessQueueService } from "#/modules/document/queue/index.js";
import {
  DocumentRepository,
  type DocumentListFilter,
  SectionRepository,
} from "#/modules/document/repository/index.js";
import { DocumentPipelineService } from "#/modules/document/services/document-pipeline.service.js";
import {
  computeProgress,
  inspectPdf,
} from "#/modules/document/utils/index.js";
import { MediaRepository } from "#/modules/media/repository/index.js";
import { TagRepository } from "#/modules/study/repository/index.js";
import { FolderService } from "#/modules/study/services/index.js";
import { ConsentService } from "#/modules/auth/services/consent.service.js";
import {
  DocumentStatus,
  RewriteMode,
  SectionStatus,
  SubscriptionPlan,
  type RewriteMode as RewriteModeValue,
} from "#database/enums.js";

const MB = 1_024 * 1_024;
const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_TITLE_LENGTH = 120;

/** Belgeler: yükleme sonrası oluşturma, listeleme, düzenleme, silme, yeniden deneme. */
@Injectable()
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly mediaRepository: MediaRepository,
    private readonly usageService: UsageService,
    private readonly quotaLock: RedisQuotaLockHelper,
    private readonly pipeline: DocumentPipelineService,
    private readonly processQueue: DocumentProcessQueueService,
    private readonly s3Service: S3Service,
    private readonly eventEmitter: EventEmitter2,
    private readonly dateManager: DateManager,
    private readonly paginator: Paginator,
    private readonly consentService: ConsentService,
    private readonly tagRepository: TagRepository,
    private readonly folderService: FolderService,
  ) {}

  /**
   * Yüklenmiş PDF'ten belge açar (doküman §4 "Ön kontrol"): tür, boyut ve
   * sayfa sınırı, şifreli/bozuk PDF (422), aynı PDF'in tekrarı (mevcut belge
   * döner), kota (402). Kota düşümü ve belge kaydı kullanıcı kilidi altında
   * tek transaction'dadır.
   */
  async create(
    body: CreateDocumentBodyDto,
    userId: number,
  ): Promise<CreatedResponse | OkResponse> {
    const { media, limits, pdf } = await this.loadPdf(body.mediaId, userId);
    const rewriteMode = await this.chooseRewriteMode(
      userId,
      limits,
      body.rewriteMode,
    );

    const result = await this.quotaLock.withLock(userId, async () => {
      // Kilit altında tekrar bak: aynı PDF eşzamanlı iki kez gönderilmiş olabilir.
      const existing = await this.documentRepository.findActiveByHash(
        userId,
        pdf.sha256,
      );
      if (existing) return { document: existing, isNew: false };

      await this.usageService.assertQuota(userId, limits, pdf.pageCount);
      const document = await this.documentRepository.createWithUsage(
        {
          userId,
          mediaId: media.id,
          title: body.title ?? titleFromFileName(media.fileName),
          pageCount: pdf.pageCount,
          sourceHash: pdf.sha256,
          storagePrefix: nanoid(16),
          rewriteMode,
        },
        this.dateManager.periodKey(),
      );
      return { document, isNew: true };
    });

    if (!result.isNew) {
      return new OkResponse(
        "Bu PDF daha önce yüklenmiş; mevcut not açıldı.",
        result.document,
      );
    }

    this.eventEmitter.emit(
      DOCUMENT_CREATED_EVENT,
      new DocumentCreatedEvent(result.document.id),
    );
    return new CreatedResponse("Not işleme alındı", result.document);
  }

  /**
   * "Sese çevir"den önce yükleme ekranının ihtiyacı: sayfa sayısı, kotaya
   * etkisi ve okuma biçimi seçenekleri. Aynı kontrolleri (tür, boyut, sayfa
   * sınırı, şifreli/bozuk PDF) yapar ama kota düşmez, not açmaz.
   */
  async preflight(
    body: DocumentPreflightBodyDto,
    userId: number,
  ): Promise<OkResponse> {
    const { media, limits, pdf } = await this.loadPdf(body.mediaId, userId);
    const [usage, existing, blockedBy] = await Promise.all([
      this.usageService.getMonthlyUsage(userId, limits),
      this.documentRepository.findActiveByHash(userId, pdf.sha256),
      this.fluentBlockedBy(userId, limits),
    ]);

    return new OkResponse("PDF kontrol edildi", {
      mediaId: media.id,
      fileName: media.fileName,
      size: media.size,
      pageCount: pdf.pageCount,
      suggestedTitle: titleFromFileName(media.fileName),
      plan: limits.plan,
      quota: {
        monthlyPages: limits.monthlyPages,
        usedPages: usage.usedPages,
        remainingPages: usage.remainingPages,
        // Aynı PDF tekrar yüklenirse mevcut not açılır, kota düşülmez.
        enough: Boolean(existing) || pdf.pageCount <= usage.remainingPages,
        resetsAt: this.dateManager.nextPeriodStart(),
      },
      proMonthlyPages: PLAN_LIMITS[SubscriptionPlan.PRO].monthlyPages,
      fluent: { available: blockedBy === null, blockedBy },
      existingDocumentId: existing?.id ?? null,
    });
  }

  /** Yüklenen PDF'i okur ve plana göre doğrular (kota hariç). */
  private async loadPdf(mediaId: number, userId: number) {
    const media = await this.mediaRepository.findOwnedById(mediaId, userId);
    if (!media) throw new NotFoundException(`Dosya bulunamadı: ${mediaId}`);
    if (media.mimeType !== "application/pdf") {
      throw new UnprocessableEntityException("Yalnızca PDF dosyaları işlenebilir.");
    }

    const limits = await this.usageService.getPlanLimits(userId);
    if (media.size > limits.maxFileBytes) {
      throw new PayloadTooLargeException(
        `Planınızda PDF boyutu en fazla ${Math.round(limits.maxFileBytes / MB)} MB olabilir.`,
      );
    }

    const buffer = await this.s3Service.getFileBuffer(media.storageKey);
    if (!buffer) {
      throw new UnprocessableEntityException(
        "PDF dosyasına erişilemedi. Lütfen yeniden yükleyin.",
      );
    }
    const pdf = await inspectPdf(buffer);
    if (pdf.pageCount > limits.maxPagesPerDocument) {
      throw new UnprocessableEntityException(
        `PDF en fazla ${limits.maxPagesPerDocument} sayfa olabilir (bu dosya ${pdf.pageCount} sayfa).`,
      );
    }
    return { media, limits, pdf };
  }

  async list(query: DocumentListQueryDto, userId: number): Promise<OkResponse> {
    const filter = await this.listFilter(query, userId);
    const { docs, pagination } = await this.paginator.applyCursor({
      cursor: query.cursor,
      limit: query.limit,
      query: (window) =>
        this.documentRepository.findPage(userId, window, filter),
    });

    // Kütüphane satırı ilerleme ve bölüm sayılarını gösterir; sayfadaki
    // belgelerin bölümleri tek sorguda okunur.
    const states = await this.sectionRepository.findStatesByDocuments(
      docs.map((document) => document.id),
    );
    const sectionsByDocument = new Map<number, typeof states>();
    for (const state of states) {
      const list = sectionsByDocument.get(state.documentId) ?? [];
      list.push(state);
      sectionsByDocument.set(state.documentId, list);
    }
    const items = docs.map((document) => {
      const sections = sectionsByDocument.get(document.id) ?? [];
      return {
        ...document,
        progressPercent: computeProgress(document.status, sections).percent,
        sections: {
          total: sections.length,
          ready: sections.filter((s) => s.status === SectionStatus.READY).length,
          failed: sections.filter((s) => s.status === SectionStatus.FAILED).length,
        },
      };
    });
    return new OkResponse("Notlar listelendi", items, { meta: { pagination } });
  }

  /** Kütüphane filtreleri: durum/sekme, klasör, etiket, favori, son N gün. */
  private async listFilter(
    query: DocumentListQueryDto,
    userId: number,
  ): Promise<DocumentListFilter> {
    let documentIds: number[] | undefined;
    if (query.tagId) {
      const tag = await this.tagRepository.findOwned(query.tagId, userId);
      if (!tag) throw new NotFoundException(`Etiket bulunamadı: ${query.tagId}`);
      documentIds = await this.tagRepository.findDocumentIds(query.tagId);
    }
    return {
      statuses: query.status
        ? [query.status]
        : query.group && DOCUMENT_GROUPS[query.group],
      folderId: query.folderId,
      favorite: query.favorite,
      documentIds,
      createdAfter: query.addedWithinDays
        ? this.dateManager.toISOString(
            this.dateManager.addMilliseconds(-query.addedWithinDays * DAY_MS),
          )
        : undefined,
    };
  }

  /** Belge + bölüm listesi + ilerleme + etiketler. */
  async get(id: number, userId: number): Promise<OkResponse> {
    const document = await this.findOwned(id, userId);
    const [sections, tags] = await Promise.all([
      this.sectionRepository.findSummariesByDocument(id),
      this.tagRepository.findForDocuments([id]),
    ]);
    return new OkResponse("Not getirildi", {
      ...document,
      sections,
      progress: computeProgress(document.status, sections),
      tags: tags.get(id) ?? [],
    });
  }

  async rename(
    id: number,
    body: UpdateDocumentBodyDto,
    userId: number,
  ): Promise<OkResponse> {
    await this.findOwned(id, userId);
    if (
      body.title === undefined &&
      body.folderId === undefined &&
      body.isFavorite === undefined
    ) {
      throw new BadRequestException("Değiştirilecek bir alan gönderilmedi.");
    }
    if (body.folderId) await this.folderService.assertOwned(body.folderId, userId);
    await this.documentRepository.update(id, {
      title: body.title,
      folderId: body.folderId,
      isFavorite: body.isFavorite,
    });
    return new OkResponse(
      "Not güncellendi",
      await this.documentRepository.findOwned(id, userId),
    );
  }

  /**
   * Soft delete. R2'deki PDF ve sesler zamanlanmış temizlik işiyle kalıcı
   * silinir; kuyruktaki işler silinmiş belgeyi yok sayar.
   */
  async delete(id: number, userId: number): Promise<NoContentResponse> {
    if (await this.documentRepository.isStoreSource(id)) {
      throw new ConflictException({
        message:
          "Bu not mağazadaki bir içeriğin kaynağı; önce içeriği mağazadan kaldırın.",
        code: "STORE_SOURCE_DOCUMENT",
      });
    }
    if (!(await this.documentRepository.softDelete(id, userId))) {
      throw new NotFoundException(`Not bulunamadı: ${id}`);
    }
    return new NoContentResponse("Not silindi");
  }

  /**
   * `PARTIAL` / `FAILED` belgede başarısız bölümleri yeniden işler. Metni
   * hazır bölümler yalnızca yeniden seslendirilir. `FAILED` belgenin kotası
   * iade edilmiş olduğundan yeniden düşülür.
   */
  async retry(id: number, userId: number): Promise<AcceptedResponse> {
    const document = await this.findOwned(id, userId);
    if (
      document.status !== DocumentStatus.PARTIAL &&
      document.status !== DocumentStatus.FAILED
    ) {
      throw new UnprocessableEntityException(
        "Yalnızca başarısız veya kısmen hazır notlar yeniden denenebilir.",
      );
    }

    const failed = (await this.sectionRepository.findForProcessing(id)).filter(
      (section) => section.status === SectionStatus.FAILED,
    );
    if (failed.length === 0) {
      throw new UnprocessableEntityException(
        "Bu not yeniden işlenemez; lütfen PDF'i tekrar yükleyin.",
      );
    }

    if (document.status === DocumentStatus.FAILED) {
      const limits = await this.usageService.getPlanLimits(userId);
      await this.quotaLock.withLock(userId, async () => {
        await this.usageService.assertQuota(userId, limits, document.pageCount);
        await this.usageService.chargeDocument(
          userId,
          id,
          document.pageCount,
        );
      });
    }

    for (const section of failed) {
      await this.sectionRepository.update(section.id, {
        status: SectionStatus.PENDING,
        attempts: section.attempts + 1,
        failureReason: null,
      });
    }
    await this.documentRepository.transition(
      id,
      [DocumentStatus.PARTIAL, DocumentStatus.FAILED],
      { status: DocumentStatus.SYNTHESIZING, failureReason: null },
    );

    const run = Math.max(...failed.map((section) => section.attempts + 1));
    await this.processQueue.enqueue(id, {
      priority: await this.pipeline.priorityFor(userId),
      run,
    });
    await this.pipeline.emitProgress(id);

    return new AcceptedResponse(
      `${failed.length} bölüm yeniden işleme alındı`,
      await this.documentRepository.findOwned(id, userId),
    );
  }

  /**
   * Bölümü baştan anlatıp yeniden seslendirir (kapsam ekranındaki "Bölümü
   * yeniden üret"). Yalnızca akıcı anlatımlı notta ve LLM hakkı varken;
   * kota düşülmez. Yeni ses hazır olana dek bölüm "işleniyor" görünür.
   */
  async regenerateSection(sectionId: number, userId: number): Promise<AcceptedResponse> {
    const section = await this.sectionRepository.findWithDocument(sectionId);
    const document = section?.document;
    if (!section || !document || document.userId !== userId || document.deletedAt) {
      throw new NotFoundException(`Bölüm bulunamadı: ${sectionId}`);
    }
    if (document.storeItemId !== null) {
      throw new UnprocessableEntityException(
        "Mağaza içeriğinin anlatımı editörlerce hazırlanır; yeniden üretilemez.",
      );
    }
    if (document.rewriteMode !== RewriteMode.FLUENT) {
      throw new UnprocessableEntityException(
        "Düz okumada anlatım nottan birebir çıkar; yeniden üretmeye gerek yok.",
      );
    }
    const limits = await this.usageService.getPlanLimits(userId);
    const blockedBy = await this.fluentBlockedBy(userId, limits);
    if (blockedBy) {
      throw new ForbiddenException(
        blockedBy === "PLAN"
          ? { message: "Bölümü yeniden üretmek Dinlet Pro'ya özel.", code: "PRO_REQUIRED" }
          : {
              message:
                "Yeniden üretim için notunun yurt dışındaki yapay zekâ servisine aktarılmasına rıza vermelisin.",
              code: "CROSS_BORDER_CONSENT_REQUIRED",
            },
      );
    }
    if (
      (section.status !== SectionStatus.READY && section.status !== SectionStatus.FAILED) ||
      (document.status !== DocumentStatus.READY && document.status !== DocumentStatus.PARTIAL)
    ) {
      throw new ConflictException("Not şu an işleniyor; bitince tekrar dene.");
    }

    await this.sectionRepository.update(sectionId, {
      status: SectionStatus.PENDING,
      script: null,
      scriptHash: null,
      attempts: section.attempts + 1,
      failureReason: null,
    });
    await this.documentRepository.transition(
      document.id,
      [DocumentStatus.READY, DocumentStatus.PARTIAL],
      { status: DocumentStatus.SYNTHESIZING },
    );
    await this.processQueue.enqueue(document.id, {
      priority: await this.pipeline.priorityFor(userId),
      // Önceki işleme job'ları aynı id'yi tutuyor olabilir.
      run: Math.floor(this.dateManager.utcNow().getTime() / 1_000),
    });
    await this.pipeline.emitProgress(document.id);
    return new AcceptedResponse("Bölüm yeniden üretiliyor", { sectionId });
  }

  /**
   * Akıcı anlatım neden seçilemiyor? Plan LLM'siz okumaysa `PLAN`. Pro'da
   * LLM ile anlatım notun yurt dışındaki yapay zekâ servisine gönderilmesi
   * demektir; açık rıza yoksa `CONSENT` (KVKK).
   */
  private async fluentBlockedBy(
    userId: number,
    limits: PlanLimits,
  ): Promise<FluentBlockReason | null> {
    if (limits.rewriteMode !== RewriteMode.FLUENT) return "PLAN";
    return fluentBlockReason(
      limits,
      await this.consentService.hasCrossBorderTransferConsent(userId),
    );
  }

  /**
   * İstenen okuma biçimi. `RAW` her zaman seçilebilir; `FLUENT` istenip
   * verilemiyorsa 403 (uygulama nedenine göre Pro veya rıza adımını açar).
   * İstenmediyse planın ve rızanın izin verdiği en iyi biçim.
   */
  private async chooseRewriteMode(
    userId: number,
    limits: PlanLimits,
    requested?: RewriteModeValue,
  ): Promise<RewriteModeValue> {
    if (requested === RewriteMode.RAW) return RewriteMode.RAW;
    const blockedBy = await this.fluentBlockedBy(userId, limits);
    if (!blockedBy) return RewriteMode.FLUENT;
    if (!requested) return RewriteMode.RAW;
    throw new ForbiddenException(
      blockedBy === "PLAN"
        ? {
            message: "Akıcı anlatım Dinlet Pro'ya özel.",
            code: "PRO_REQUIRED",
          }
        : {
            message:
              "Akıcı anlatım için notlarının yurt dışındaki yapay zekâ servisine aktarılmasına rıza vermelisin.",
            code: "CROSS_BORDER_CONSENT_REQUIRED",
          },
    );
  }

  private async findOwned(id: number, userId: number) {
    const document = await this.documentRepository.findOwned(id, userId);
    if (!document) throw new NotFoundException(`Not bulunamadı: ${id}`);
    return document;
  }
}

/** "osmanli-kurulus.pdf" → "osmanli-kurulus" */
function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").trim();
  return (base || "Adsız not").slice(0, MAX_TITLE_LENGTH);
}
