import { Injectable } from "@nestjs/common";

import type { PageWindow } from "#/core/utils/paginator.js";
import { DatabaseService } from "#database/database.service.js";
import { GenerationStatus, type StoreSource } from "#database/enums.js";

const ITEM_FIELDS = [
  "id",
  "slug",
  "title",
  "description",
  "source",
  "publisherName",
  "credit",
  "documentId",
  "productId",
  "priceTry",
  "sampleSections",
  "isFeatured",
  "isPublished",
  "position",
  "publishedAt",
  "createdAt",
  "updatedAt",
] as const;

/** Mağaza listesinin süzgeçleri (hepsi birlikte uygulanır). */
export interface StoreItemFilter {
  /** `true` yayındakiler, `false` yayında olmayanlar; verilmezse hepsi. */
  published?: boolean;
  /** Kategori / sahiplik gibi dış bir süzgeçten gelen içerik kümesi. */
  ids?: number[];
  /** Bu içerikler hariç (ör. sahip olunmayanlar). */
  excludeIds?: number[];
  source?: StoreSource;
  /** `true` ücretsizler, `false` ücretliler. */
  free?: boolean;
  featured?: boolean;
  /** Başlıkta geçen metin. */
  search?: string;
}

export interface StoreItemInput {
  slug?: string;
  title?: string;
  description?: string;
  source?: StoreSource;
  publisherName?: string | null;
  credit?: string | null;
  authorUserId?: number | null;
  documentId?: number;
  productId?: string | null;
  priceTry?: string | null;
  sampleSections?: number;
  isFeatured?: boolean;
  isPublished?: boolean;
  position?: number;
  publishedAt?: string | null;
}

/** Kaynak notun mağaza kartında gösterilen özeti. */
export interface StoreContentStats {
  sectionCount: number;
  totalDurationMs: number | null;
  pageCount: number;
  rewriteMode: string;
  questionCount: number;
  /** Tüm bölümlerin hızlı tekrar sesi hazır. */
  hasQuickVersion: boolean;
}

/** Mağaza içerikleri ve kaynak notları. */
@Injectable()
export class StoreItemRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  private filtered(filter: StoreItemFilter) {
    let query = this.db.orm.public.StoreItem.where((item) => item.id.gt(0));
    if (filter.published !== undefined) {
      query = query.where({ isPublished: filter.published });
    }
    if (filter.ids) query = query.where((item) => item.id.in(filter.ids!));
    if (filter.excludeIds?.length) {
      query = query.where((item) => item.id.notIn(filter.excludeIds!));
    }
    if (filter.source) query = query.where({ source: filter.source });
    if (filter.free === true)
      query = query.where((item) => item.productId.isNull());
    if (filter.free === false) {
      query = query.where((item) => item.productId.isNotNull());
    }
    if (filter.featured !== undefined) {
      query = query.where({ isFeatured: filter.featured });
    }
    if (filter.search) {
      const pattern = `%${filter.search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
      query = query.where((item) => item.title.ilike(pattern));
    }
    return query;
  }

  async count(filter: StoreItemFilter): Promise<number> {
    // Boş küme (ör. hiç içeriği olmayan kategori): sorguya gerek yok.
    if (filter.ids?.length === 0) return 0;
    const { total } = await this.filtered(filter).aggregate((aggregate) => ({
      total: aggregate.count(),
    }));
    return total;
  }

  async findPage(filter: StoreItemFilter, window: PageWindow) {
    if (filter.ids?.length === 0) return [];
    return await this.filtered(filter)
      .select(...ITEM_FIELDS)
      .orderBy([(item) => item.position.asc(), (item) => item.id.desc()])
      .limit(window.limit)
      .offset(window.offset)
      .all();
  }

  findById(id: number) {
    return this.db.orm.public.StoreItem.where({ id })
      .select(...ITEM_FIELDS)
      .first();
  }

  findByIds(ids: number[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.db.orm.public.StoreItem.where((item) => item.id.in(ids))
      .select(...ITEM_FIELDS)
      .all();
  }

  findByProductId(productId: string) {
    return this.db.orm.public.StoreItem.where({ productId })
      .select("id")
      .first();
  }

  findBySlug(slug: string) {
    return this.db.orm.public.StoreItem.where({ slug }).select("id").first();
  }

  findByDocumentId(documentId: number) {
    return this.db.orm.public.StoreItem.where({ documentId })
      .select("id")
      .first();
  }

  /** Kategorideki içerikler (kategori süzgeci). */
  async findIdsByCategories(categoryIds: number[]): Promise<number[]> {
    if (categoryIds.length === 0) return [];
    const links = await this.db.orm.public.StoreItemCategory.where((link) =>
      link.categoryId.in(categoryIds),
    )
      .select("storeItemId")
      .all();
    return [...new Set(links.map((link) => link.storeItemId))];
  }

  /** İçeriklerin kategori ID'leri (tek sorgu). */
  async findCategoryIds(itemIds: number[]): Promise<Map<number, number[]>> {
    const byItem = new Map<number, number[]>();
    if (itemIds.length === 0) return byItem;
    const links = await this.db.orm.public.StoreItemCategory.where((link) =>
      link.storeItemId.in(itemIds),
    )
      .select("storeItemId", "categoryId")
      .all();
    for (const link of links) {
      byItem.set(link.storeItemId, [
        ...(byItem.get(link.storeItemId) ?? []),
        link.categoryId,
      ]);
    }
    return byItem;
  }

  /** Kaynak notların bölüm sayısı, süresi, soru sayısı (tek seferde). */
  async findStats(
    documentIds: number[],
  ): Promise<Map<number, StoreContentStats>> {
    const stats = new Map<number, StoreContentStats>();
    if (documentIds.length === 0) return stats;

    const [documents, sections] = await Promise.all([
      this.db.orm.public.Document.where((document) =>
        document.id.in(documentIds),
      )
        .select("id", "totalDurationMs", "pageCount", "rewriteMode")
        .all(),
      this.db.orm.public.Section.where((section) =>
        section.documentId.in(documentIds),
      )
        .select("id", "documentId", "quickStatus")
        .all(),
    ]);
    const questions =
      sections.length === 0
        ? []
        : await this.db.orm.public.QuizQuestion.where((question) =>
            question.sectionId.in(sections.map((section) => section.id)),
          )
            .select("sectionId")
            .all();

    const documentBySection = new Map(
      sections.map((section) => [section.id, section.documentId]),
    );
    for (const document of documents) {
      const own = sections.filter(
        (section) => section.documentId === document.id,
      );
      stats.set(document.id, {
        sectionCount: own.length,
        totalDurationMs: document.totalDurationMs,
        pageCount: document.pageCount,
        rewriteMode: document.rewriteMode,
        questionCount: 0,
        hasQuickVersion:
          own.length > 0 &&
          own.every(
            (section) => section.quickStatus === GenerationStatus.READY,
          ),
      });
    }
    for (const question of questions) {
      const documentId = documentBySection.get(question.sectionId);
      const entry =
        documentId === undefined ? undefined : stats.get(documentId);
      if (entry) entry.questionCount++;
    }
    return stats;
  }

  /** İçindekiler: kaynak notun bölümleri (örnek bölümlerin sesi için anahtar dahil). */
  findSections(documentId: number) {
    return this.db.orm.public.Section.where({ documentId })
      .select(
        "id",
        "order",
        "title",
        "durationMs",
        "audioKey",
        "pageStart",
        "pageEnd",
      )
      .orderBy((section) => section.order.asc())
      .all();
  }

  /** Yayınlanacak kaynak not (sahibi ve durumuyla). */
  findSourceDocument(documentId: number) {
    return this.db.orm.public.Document.where({ id: documentId })
      .select("id", "userId", "title", "status", "storeItemId", "deletedAt")
      .first();
  }

  /**
   * Hesabı silinen yazarın topluluk notlarını yayından kaldırır (sahipleri
   * kütüphanelerinde tutar). Kaldırılan içerik sayısı döner.
   */
  async unpublishByAuthor(authorUserId: number): Promise<number> {
    return this.db.orm.public.StoreItem.where({
      authorUserId,
      isPublished: true,
    }).updateAndCount({ isPublished: false });
  }

  /** İçeriği ve kategori bağlarını birlikte yazar. */
  create(
    input: Required<
      Pick<
        StoreItemInput,
        "slug" | "title" | "description" | "source" | "documentId"
      >
    > &
      StoreItemInput,
    categoryIds: number[],
  ) {
    return this.db.transaction(async (tx) => {
      const item = await tx.orm.public.StoreItem.select("id").create(input);
      if (categoryIds.length > 0) {
        await tx.orm.public.StoreItemCategory.createAll(
          categoryIds.map((categoryId) => ({
            storeItemId: item.id,
            categoryId,
          })),
        );
      }
      return item;
    });
  }

  /** Alanları günceller; `categoryIds` verilirse kategori bağlarını değiştirir. */
  update(id: number, patch: StoreItemInput, categoryIds?: number[]) {
    return this.db.transaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        await tx.orm.public.StoreItem.where({ id }).updateAndCount(patch);
      }
      if (categoryIds) {
        await tx.orm.public.StoreItemCategory.where({
          storeItemId: id,
        }).deleteAndCount();
        if (categoryIds.length > 0) {
          await tx.orm.public.StoreItemCategory.createAll(
            categoryIds.map((categoryId) => ({ storeItemId: id, categoryId })),
          );
        }
      }
    });
  }
}
