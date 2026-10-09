import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { nanoid } from "nanoid";

import { CreatedResponse, OkResponse } from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { generateSlug } from "#/core/utils/generate-slug.js";
import { Paginator } from "#/core/utils/paginator.js";
import { S3Service } from "#/infra/s3/s3.service.js";
import { DocumentRepository } from "#/modules/document/repository/index.js";
import type {
  AdminSubmissionListQueryDto,
  ApproveSubmissionBodyDto,
  CreateSubmissionBodyDto,
  SubmissionListQueryDto,
} from "#/modules/store/dtos/index.js";
import {
  STORE_SUBMISSION_REVIEWED_EVENT,
  StoreSubmissionReviewedEvent,
} from "#/modules/store/event/store.events.js";
import {
  StoreCategoryRepository,
  StoreItemRepository,
  StoreLibraryRepository,
  StoreSubmissionRepository,
} from "#/modules/store/repository/index.js";
import {
  DocumentStatus,
  StoreSource,
  SubmissionStatus,
} from "#database/enums.js";

/** Kullanıcı başına aynı anda incelemede bekleyebilecek başvuru. */
const MAX_PENDING = 5;
/** Ses dosyası kopyalarında eşzamanlılık. */
const COPY_CONCURRENCY = 8;

type SubmissionRow = NonNullable<
  Awaited<ReturnType<StoreSubmissionRepository["findById"]>>
>;

/**
 * Herkes notunu mağazada ücretsiz paylaşabilir; editör onaylayınca yayına
 * girer. Onayda notun o anki hâli, ses dosyalarıyla birlikte ayrı bir
 * kaynak nota kopyalanır (`isStoreMaster`): yazar sonra kendi notunu
 * değiştirse veya silse de mağazadaki sürüm ve onu ekleyenlerin
 * kütüphanesi etkilenmez.
 */
@Injectable()
export class StoreSubmissionService {
  private readonly logger = new Logger(StoreSubmissionService.name);

  constructor(
    private readonly submissionRepository: StoreSubmissionRepository,
    private readonly categoryRepository: StoreCategoryRepository,
    private readonly itemRepository: StoreItemRepository,
    private readonly libraryRepository: StoreLibraryRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly s3Service: S3Service,
    private readonly eventEmitter: EventEmitter2,
    private readonly dateManager: DateManager,
    private readonly paginator: Paginator,
  ) {}

  // ─── Kullanıcı ───────────────────────────────────────────────────────────

  async submit(
    body: CreateSubmissionBodyDto,
    userId: number,
  ): Promise<CreatedResponse> {
    const document = await this.documentRepository.findOwned(
      body.documentId,
      userId,
    );
    if (!document)
      throw new NotFoundException(`Not bulunamadı: ${body.documentId}`);
    if (document.storeItemId !== null) {
      throw new UnprocessableEntityException(
        "Mağazadan eklediğin içerik yeniden paylaşılamaz.",
      );
    }
    if (document.status !== DocumentStatus.READY) {
      throw new UnprocessableEntityException(
        "Yalnızca tüm bölümleri hazır notlar paylaşılabilir.",
      );
    }
    if (await this.documentRepository.isStoreSource(document.id)) {
      throw new ConflictException({
        message: "Bu not zaten mağazada.",
        code: "SUBMISSION_EXISTS",
      });
    }
    const active = await this.submissionRepository.findActiveForDocument(
      document.id,
    );
    if (active) {
      throw new ConflictException({
        message:
          active.status === SubmissionStatus.PENDING
            ? "Bu not zaten incelemede."
            : "Bu not zaten mağazada paylaşılıyor.",
        code: "SUBMISSION_EXISTS",
      });
    }
    if ((await this.submissionRepository.countPending(userId)) >= MAX_PENDING) {
      throw new UnprocessableEntityException(
        `Aynı anda en fazla ${MAX_PENDING} not incelemede bekleyebilir.`,
      );
    }
    const categoryIds = await this.assertCategories(body.categoryIds);

    const submission = await this.submissionRepository.create({
      userId,
      documentId: document.id,
      title: body.title,
      description: body.description,
      categoryIds,
      rightsConfirmedAt: this.dateManager.toISOString(),
    });
    return new CreatedResponse(
      "Notun incelemeye gönderildi; onaylanınca mağazada herkes dinleyebilecek.",
      submission,
    );
  }

  async listMine(
    query: SubmissionListQueryDto,
    userId: number,
  ): Promise<OkResponse> {
    const filter = { userId, documentId: query.documentId };
    const { docs, pagination } = await this.paginator.apply({
      page: query.page,
      limit: query.limit,
      count: () => this.submissionRepository.count(filter),
      query: (window) => this.submissionRepository.findPage(filter, window),
    });
    return new OkResponse("Paylaşımların listelendi", docs, {
      meta: { pagination },
    });
  }

  /**
   * İncelemedeki başvuruyu geri çeker; yayındaysa içeriği mağazadan
   * kaldırır (daha önce ekleyenlerin kütüphanesinde kalır).
   */
  async withdraw(id: number, userId: number): Promise<OkResponse> {
    const submission = await this.submissionRepository.findById(id);
    if (!submission || submission.userId !== userId) {
      throw new NotFoundException(`Paylaşım bulunamadı: ${id}`);
    }
    if (submission.status === SubmissionStatus.PENDING) {
      await this.submissionRepository.transition(id, SubmissionStatus.PENDING, {
        status: SubmissionStatus.WITHDRAWN,
      });
    } else if (submission.status === SubmissionStatus.APPROVED) {
      if (submission.storeItemId) {
        await this.itemRepository.update(submission.storeItemId, {
          isPublished: false,
        });
      }
      await this.submissionRepository.transition(
        id,
        SubmissionStatus.APPROVED,
        {
          status: SubmissionStatus.WITHDRAWN,
        },
      );
    } else {
      throw new ConflictException("Bu paylaşım zaten kapalı.");
    }
    return new OkResponse(
      submission.status === SubmissionStatus.APPROVED
        ? "Notun mağazadan kaldırıldı"
        : "Başvurun geri çekildi",
      await this.submissionRepository.findById(id),
    );
  }

  /** Hesabı silinen kullanıcının topluluk notları yayından kalkar. */
  async unpublishAuthor(userId: number): Promise<void> {
    const count = await this.itemRepository.unpublishByAuthor(userId);
    if (count > 0) {
      this.logger.log(
        `Kullanıcı#${userId} silindi: ${count} topluluk notu yayından kaldırıldı`,
      );
    }
  }

  // ─── Editör ──────────────────────────────────────────────────────────────

  async listForReview(query: AdminSubmissionListQueryDto): Promise<OkResponse> {
    const status = query.status ?? SubmissionStatus.PENDING;
    const filter = { status };
    const { docs, pagination } = await this.paginator.apply({
      page: query.page,
      limit: query.limit,
      count: () => this.submissionRepository.count(filter),
      // İnceleme kuyruğu ilk gelen önce.
      query: (window) =>
        this.submissionRepository.findPage(
          filter,
          window,
          status === SubmissionStatus.PENDING,
        ),
    });
    const [users, stats] = await Promise.all([
      this.submissionRepository.findUsers([
        ...new Set(docs.map((row) => row.userId)),
      ]),
      this.itemRepository.findStats(
        docs.flatMap((row) =>
          row.documentId === null ? [] : [row.documentId],
        ),
      ),
    ]);
    const items = docs.map((row) => {
      const user = users.get(row.userId);
      return {
        ...row,
        author: {
          id: row.userId,
          name:
            [user?.name, user?.surname].filter(Boolean).join(" ") || "Adsız",
          email: user?.email ?? "",
        },
        sectionCount:
          row.documentId === null
            ? 0
            : (stats.get(row.documentId)?.sectionCount ?? 0),
      };
    });
    return new OkResponse("Paylaşım başvuruları", items, {
      meta: { pagination },
    });
  }

  async approve(
    id: number,
    body: ApproveSubmissionBodyDto,
    reviewerId: number,
  ): Promise<OkResponse> {
    const submission = await this.findPending(id);
    const document = submission.documentId
      ? await this.documentRepository.findOwned(
          submission.documentId,
          submission.userId,
        )
      : null;
    if (!document || document.status !== DocumentStatus.READY) {
      throw new ConflictException(
        "Not silinmiş veya şu an hazır değil; başvuruyu reddedin.",
      );
    }
    const categoryIds = await this.assertCategories(
      body.categoryIds ?? submission.categoryIds,
    );
    const title = body.title ?? submission.title;

    // Kopya onaylayan editöre ait: yazar hesabını silse de mağaza sürümü kalır.
    const masterId = await this.snapshot(document.id, reviewerId, title);
    const author = (
      await this.submissionRepository.findUsers([submission.userId])
    ).get(submission.userId);
    let itemId: number;
    try {
      const item = await this.itemRepository.create(
        {
          slug: `${generateSlug(title) || "not"}-${submission.id}`,
          title,
          description: body.description ?? submission.description,
          source: StoreSource.COMMUNITY,
          credit: authorCredit(author?.name ?? null, author?.surname ?? null),
          authorUserId: submission.userId,
          documentId: masterId,
          productId: null,
          sampleSections: 1,
          isPublished: true,
          publishedAt: this.dateManager.toISOString(),
        },
        categoryIds,
      );
      itemId = item.id;
    } catch (error) {
      await this.discardSnapshot(masterId);
      throw error;
    }

    const decided = await this.submissionRepository.transition(
      id,
      SubmissionStatus.PENDING,
      {
        status: SubmissionStatus.APPROVED,
        storeItemId: itemId,
        reviewedBy: reviewerId,
        reviewedAt: this.dateManager.toISOString(),
      },
    );
    if (!decided) {
      // Bu arada geri çekildi veya başka editör karar verdi: içerik yayına girmez.
      await this.itemRepository.update(itemId, { isPublished: false });
      throw new ConflictException(
        "Başvuru bu arada değişti; listeyi yenileyin.",
      );
    }

    this.eventEmitter.emit(
      STORE_SUBMISSION_REVIEWED_EVENT,
      new StoreSubmissionReviewedEvent(
        submission.userId,
        id,
        title,
        true,
        itemId,
        null,
      ),
    );
    return new OkResponse(
      "Paylaşım onaylandı ve yayında",
      await this.submissionRepository.findById(id),
    );
  }

  async reject(
    id: number,
    reason: string,
    reviewerId: number,
  ): Promise<OkResponse> {
    const submission = await this.findPending(id);
    const decided = await this.submissionRepository.transition(
      id,
      SubmissionStatus.PENDING,
      {
        status: SubmissionStatus.REJECTED,
        rejectionReason: reason,
        reviewedBy: reviewerId,
        reviewedAt: this.dateManager.toISOString(),
      },
    );
    if (!decided)
      throw new ConflictException(
        "Başvuru bu arada değişti; listeyi yenileyin.",
      );

    this.eventEmitter.emit(
      STORE_SUBMISSION_REVIEWED_EVENT,
      new StoreSubmissionReviewedEvent(
        submission.userId,
        id,
        submission.title,
        false,
        null,
        reason,
      ),
    );
    return new OkResponse(
      "Paylaşım reddedildi",
      await this.submissionRepository.findById(id),
    );
  }

  private async findPending(id: number): Promise<SubmissionRow> {
    const submission = await this.submissionRepository.findById(id);
    if (!submission) throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
    if (submission.status !== SubmissionStatus.PENDING) {
      throw new ConflictException("Bu başvuru zaten sonuçlanmış.");
    }
    return submission;
  }

  private async assertCategories(ids: number[]): Promise<number[]> {
    const unique = [...new Set(ids)];
    const existing = await this.categoryRepository.findExistingIds(unique);
    if (existing.length !== unique.length) {
      throw new UnprocessableEntityException(
        "Seçilen sınav veya ders bulunamadı.",
      );
    }
    return unique;
  }

  /**
   * Notun bölümlerini, anlatımını, sorularını ve ses dosyalarını yeni bir
   * kaynak nota kopyalar. Dosyalar `store/<önek>/` altına kopyalanır; yazarın
   * notu silinip temizlense de mağaza sürümü çalmaya devam eder.
   */
  private async snapshot(
    documentId: number,
    ownerId: number,
    title: string,
  ): Promise<number> {
    const prefix = nanoid(16);
    const keys = new Map<string, string>();
    const masterId = await this.libraryRepository.createCopy({
      userId: ownerId,
      storeItemId: null,
      sourceDocumentId: documentId,
      title,
      storagePrefix: prefix,
      isStoreMaster: true,
      mapKey: (key) => {
        let mapped = keys.get(key);
        if (!mapped) {
          mapped = `store/${prefix}/${keys.size}-${key.split("/").pop()}`;
          keys.set(key, mapped);
        }
        return mapped;
      },
    });

    try {
      const pairs = [...keys.entries()];
      for (let index = 0; index < pairs.length; index += COPY_CONCURRENCY) {
        await Promise.all(
          pairs
            .slice(index, index + COPY_CONCURRENCY)
            .map(([source, target]) => this.s3Service.copyFile(source, target)),
        );
      }
    } catch (error) {
      await this.discardSnapshot(masterId, [...keys.values()]);
      throw error;
    }
    return masterId;
  }

  private async discardSnapshot(
    masterId: number,
    keys: string[] = [],
  ): Promise<void> {
    try {
      await this.documentRepository.hardDelete(masterId, null);
      if (keys.length > 0) await this.s3Service.deleteFiles(keys);
    } catch (error) {
      this.logger.error(
        `Kaynak kopya#${masterId} temizlenemedi: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** Mağazada yazar: "Selin D." (soyadı yalnızca baş harfiyle). */
function authorCredit(name: string | null, surname: string | null): string {
  const first = name?.trim();
  const initial = surname?.trim().charAt(0).toLocaleUpperCase("tr-TR");
  if (!first) return "Dinlet kullanıcısı";
  return initial ? `${first} ${initial}.` : first;
}
