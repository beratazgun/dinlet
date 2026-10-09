import { Injectable } from "@nestjs/common";

import type { CursorWindow } from "#/core/utils/paginator.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { DatabaseService } from "#database/database.service.js";
import type {
  DocumentStatus,
  ExtractQuality,
  GenerationStatus,
  RewriteMode,
} from "#database/enums.js";

const LIST_FIELDS = [
  "id",
  "title",
  "status",
  "pageCount",
  "totalDurationMs",
  "rewriteMode",
  "extractQuality",
  "failureReason",
  "folderId",
  "isFavorite",
  "storeItemId",
  "createdAt",
  "updatedAt",
] as const;

export interface NewDocument {
  userId: number;
  mediaId: number;
  title: string;
  pageCount: number;
  sourceHash: string;
  storagePrefix: string;
  rewriteMode: RewriteMode;
}

export interface DocumentPatch {
  status?: DocumentStatus;
  title?: string;
  totalChars?: number;
  totalDurationMs?: number | null;
  failureReason?: string | null;
  extractedKey?: string | null;
  extractQuality?: ExtractQuality | null;
  folderId?: number | null;
  isFavorite?: boolean;
  mnemonicStatus?: GenerationStatus | null;
}

/** Kütüphane listesinin filtreleri (hepsi birlikte uygulanır). */
export interface DocumentListFilter {
  statuses?: readonly DocumentStatus[];
  folderId?: number;
  /** Etiket gibi dış bir süzgeçten gelen not kümesi. */
  documentIds?: number[];
  favorite?: boolean;
  /** Bu andan sonra eklenenler (ISO). */
  createdAfter?: string;
}

/**
 * Belgeler. Tüm kullanıcı sorguları sahiplik ve soft delete filtresiyle;
 * mağazadaki topluluk notlarının kaynak kopyaları (`isStoreMaster`)
 * yazarın kütüphanesinde görünmez ve onun tarafından değiştirilemez.
 */
@Injectable()
export class DocumentRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly dateManager: DateManager,
  ) {}

  private get db() {
    return this.database.client;
  }

  /** Kullanıcının silinmemiş belgesi. */
  findOwned(id: number, userId: number) {
    return this.db.orm.public.Document.where({ id, userId, isStoreMaster: false })
      .where((document) => document.deletedAt.isNull())
      .select(...LIST_FIELDS)
      .first();
  }

  /** Çalışma araçları için: durum ve kanca üretim durumu. */
  findOwnedForStudy(id: number, userId: number) {
    return this.db.orm.public.Document.where({ id, userId, isStoreMaster: false })
      .where((document) => document.deletedAt.isNull())
      .select("id", "userId", "status", "rewriteMode", "mnemonicStatus")
      .first();
  }

  /** Aynı PDF'in (aynı özet) kullanıcıdaki silinmemiş kopyası. */
  findActiveByHash(userId: number, sourceHash: string) {
    return this.db.orm.public.Document.where({ userId, sourceHash, isStoreMaster: false })
      .where((document) => document.deletedAt.isNull())
      .select(...LIST_FIELDS)
      .first();
  }

  /** İşleme hattının ihtiyaç duyduğu tüm alanlar (silinmiş belge dahil). */
  findForPipeline(id: number) {
    return this.db.orm.public.Document.where({ id })
      .select(
        "id",
        "userId",
        "title",
        "status",
        "pageCount",
        "rewriteMode",
        "storagePrefix",
        "extractedKey",
        "deletedAt",
      )
      .include("media", (media) => media.select("storageKey"))
      .first();
  }

  /**
   * Belgeyi `QUEUED` olarak açar ve kotadan sayfa düşümünü aynı
   * transaction'da yazar: biri olmadan diğeri kalmaz.
   */
  createWithUsage(input: NewDocument, periodKey: string) {
    return this.db.transaction(async (tx) => {
      const document = await tx.orm.public.Document.select(
        ...LIST_FIELDS,
      ).create(input);
      await tx.orm.public.UsageLedger.create({
        userId: input.userId,
        documentId: document.id,
        pages: input.pageCount,
        periodKey,
      });
      return document;
    });
  }

  async update(id: number, patch: DocumentPatch): Promise<void> {
    await this.db.orm.public.Document.where({ id }).updateAndCount(patch);
  }

  /**
   * Durumu yalnızca belge beklenen durumlardan birindeyse değiştirir
   * (kuyruk olayları tekrar veya geç gelebilir). Değiştiyse `true`.
   */
  async transition(
    id: number,
    from: DocumentStatus[],
    patch: DocumentPatch & { status: DocumentStatus },
  ): Promise<boolean> {
    const updated = await this.db.orm.public.Document.where({ id })
      .where((document) => document.status.in(from))
      .where((document) => document.deletedAt.isNull())
      .updateAndCount(patch);
    return updated > 0;
  }

  async findPage(
    userId: number,
    window: CursorWindow,
    filter: DocumentListFilter = {},
  ) {
    let query = this.db.orm.public.Document.where({ userId, isStoreMaster: false }).where(
      (document) => document.deletedAt.isNull(),
    );
    const { statuses, folderId, documentIds, favorite, createdAfter } = filter;
    if (statuses?.length) {
      query = query.where((document) => document.status.in([...statuses]));
    }
    if (folderId !== undefined) query = query.where({ folderId });
    if (favorite !== undefined) query = query.where({ isFavorite: favorite });
    if (documentIds) {
      // Boş küme (ör. hiç notu olmayan etiket): sorguya gerek yok.
      if (documentIds.length === 0) return [];
      query = query.where((document) => document.id.in(documentIds));
    }
    if (createdAfter) {
      query = query.where((document) => document.createdAt.gte(createdAfter));
    }
    const after = window.after;
    if (after) {
      query = query.where((document) =>
        document.createdAt.lte(after.createdAt),
      );
    }
    return await query
      .select(...LIST_FIELDS)
      .orderBy([
        (document) => document.createdAt.desc(),
        (document) => document.id.desc(),
      ])
      .cursor(after ?? {})
      .limit(window.limit)
      .all();
  }

  /**
   * Belgeyi soft delete eder; bölümlerinin dinleme kayıtları silinir ki
   * "kaldığın yerden devam et" listesinde görünmesin.
   */
  softDelete(id: number, userId: number): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const deleted = await tx.orm.public.Document.where({ id, userId, isStoreMaster: false })
        .where((document) => document.deletedAt.isNull())
        .updateAndCount({ deletedAt: this.dateManager.toISOString() });
      if (deleted === 0) return false;

      const sections = await tx.orm.public.Section.where({ documentId: id })
        .select("id")
        .all();
      if (sections.length > 0) {
        await tx.orm.public.PlaybackProgress.where((progress) =>
          progress.sectionId.in(sections.map((section) => section.id)),
        ).deleteAndCount();
      }
      return true;
    });
  }

  /** Not mağazadaki bir içeriğin kaynağı mı? (Kaynak not silinemez.) */
  async isStoreSource(id: number): Promise<boolean> {
    const item = await this.db.orm.public.StoreItem.where({ documentId: id })
      .select("id")
      .first();
    return item !== null;
  }

  /**
   * Kullanıcının tüm silinmemiş belgelerini soft delete eder (hesap silme).
   * Mağaza içeriklerinin kaynak notları kalır: sahiplerinin kopyaları bu
   * notların ses dosyalarını kullanır.
   */
  async softDeleteAllForUser(userId: number): Promise<number> {
    const documents = await this.db.orm.public.Document.where({ userId })
      .where((document) => document.deletedAt.isNull())
      .select("id")
      .all();
    let deleted = 0;
    for (const document of documents) {
      if (await this.isStoreSource(document.id)) continue;
      await this.softDelete(document.id, userId);
      deleted++;
    }
    return deleted;
  }

  /** Kalıcı silinmeyi bekleyen (soft delete'i `before`'dan eski) belgeler. */
  findPurgeable(before: string, limit: number) {
    return this.db.orm.public.Document.where((document) =>
      document.deletedAt.isNotNull(),
    )
      .where((document) => document.deletedAt.lt(before))
      .select("id", "userId", "storagePrefix", "extractedKey", "mediaId")
      .include("media", (media) => media.select("storageKey"))
      .orderBy((document) => document.id.asc())
      .limit(limit)
      .all();
  }

  /**
   * Belgeyi ve PDF'inin medya kaydını (mağaza kopyasında yok) kalıcı siler.
   * Bölümler ve dinleme kayıtları FK ile birlikte silinir; kota defteri ve
   * LLM kullanımı istatistik için belgesiz kalır.
   */
  hardDelete(id: number, mediaId: number | null) {
    return this.db.transaction(async (tx) => {
      await tx.orm.public.Document.where({ id }).deleteAndCount();
      if (mediaId !== null) {
        await tx.orm.public.Media.where({ id: mediaId }).deleteAndCount();
      }
    });
  }

  /** Verilen durumlarda `olderThan`'dan beri güncellenmemiş belgeler. */
  findStale(statuses: DocumentStatus[], olderThan: string, limit: number) {
    return this.db.orm.public.Document.where((document) =>
      document.status.in(statuses),
    )
      .where((document) => document.updatedAt.lt(olderThan))
      .where((document) => document.deletedAt.isNull())
      .select("id", "status", "updatedAt")
      .orderBy((document) => document.updatedAt.asc())
      .limit(limit)
      .all();
  }
}
