import { BadRequestException, Injectable } from "@nestjs/common";

export const DEFAULT_PAGE_LIMIT = 20;
/** Tek istekte dönebilecek en fazla kayıt. Request DTO'ları da `@Max` ile aynı sınırı uygular. */
export const MAX_PAGE_LIMIT = 100;

/** İmleçteki zaman damgası: ISO 8601 veya Postgres `timestamptz` metin çıktısı. */
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/;

// ─── Offset (sayfa numaralı) ────────────────────────────────────────────────

/** Sayfalı sorgu girdisi. Request DTO'ları (`PageQueryDto`) bu şekli sağlar. */
export interface PageQuery {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  kind: "offset";
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  nextPage: number | null;
  prevPage: number | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface Paginated<T> {
  docs: T[];
  pagination: PaginationMeta;
}

export interface PageWindow {
  limit: number;
  offset: number;
}

export interface PaginationOptions<T> extends PageQuery {
  count: () => Promise<number>;
  query: (window: PageWindow) => PromiseLike<T[]>;
}

// ─── Keyset (imleçli) ───────────────────────────────────────────────────────

/** İmleçli sorgu girdisi. Request DTO'ları (`CursorQueryDto`) bu şekli sağlar. */
export interface CursorQuery {
  /** Önceki yanıttaki `nextCursor`; yoksa ilk sayfa. */
  cursor?: string;
  limit?: number;
}

/**
 * Keyset konumu. İmleçli listelerin TAMAMI `(createdAt, id)` ile sıralanır:
 * `createdAt` sıralamayı, benzersiz `id` eşit zaman damgalarında sırayı belirler.
 */
export interface SeekKey {
  /** ISO 8601 — DB'den geldiği hassasiyetle (mikrosaniye) korunur. */
  createdAt: string;
  id: number;
}

export interface CursorWindow {
  /** İstenen `limit + 1`: fazladan gelen kayıt sonraki sayfanın varlığını gösterir. */
  limit: number;
  /** Bu konumdan SONRAKİ kayıtlar (sıralama yönünde); ilk sayfada `null`. */
  after: SeekKey | null;
}

export interface CursorPaginationMeta {
  kind: "cursor";
  limit: number;
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface CursorPaginated<T> {
  docs: T[];
  pagination: CursorPaginationMeta;
}

export interface CursorPaginationOptions<T extends SeekKey> extends CursorQuery {
  query: (window: CursorWindow) => PromiseLike<T[]>;
}

/**
 * Tüm liste servis'lerinin kullandığı TEK sayfalama motoru. İki mod:
 *
 * - `apply` / `applyToArray` (offset): toplam kayıt ve sayfa numarası verir;
 *   her istekte `COUNT` çalışır ve derin sayfalarda `OFFSET` atlanan satırları
 *   okur. Yalnızca boyutu sınırlı listeler içindir (job tanımları, oturumlar).
 * - `applyCursor` (keyset): `COUNT` yok, maliyet sayfa derinliğinden bağımsız
 *   (`WHERE (created_at, id) < (…) ORDER BY … LIMIT n+1`, index taraması).
 *   Sürekli büyüyen tablolar içindir (audit log, job çalıştırmaları).
 *
 * Transport bilmez: HATEOAS linkleri (`nextUrl`/`prevUrl`) presentation
 * katmanında `SerializeInterceptor` tarafından istekten türetilir.
 */
@Injectable()
export class Paginator {
  async apply<T>(options: PaginationOptions<T>): Promise<Paginated<T>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = this.clampLimit(options.limit);
    const offset = (page - 1) * limit;
    const [totalDocs, docs] = await Promise.all([
      options.count(),
      Promise.resolve(options.query({ limit, offset })),
    ]);

    return { docs, pagination: this.buildOffsetMeta(page, limit, totalDocs) };
  }

  /** Bellekteki bir diziyi sayfalar (ör. Redis'ten okunan küçük listeler). */
  applyToArray<T>(items: T[], query: PageQuery): Promise<Paginated<T>> {
    return this.apply({
      ...query,
      count: () => Promise.resolve(items.length),
      query: ({ limit, offset }) =>
        Promise.resolve(items.slice(offset, offset + limit)),
    });
  }

  async applyCursor<T extends SeekKey>(
    options: CursorPaginationOptions<T>,
  ): Promise<CursorPaginated<T>> {
    const limit = this.clampLimit(options.limit);
    const after = options.cursor ? this.decodeCursor(options.cursor) : null;
    const rows = await options.query({ limit: limit + 1, after });

    const hasNextPage = rows.length > limit;
    const docs = hasNextPage ? rows.slice(0, limit) : rows;
    const last = docs.at(-1);

    return {
      docs,
      pagination: {
        kind: "cursor",
        limit,
        nextCursor: hasNextPage && last ? this.encodeCursor(last) : null,
        hasNextPage,
      },
    };
  }

  private clampLimit(limit: number | undefined): number {
    return Math.min(MAX_PAGE_LIMIT, Math.max(1, limit ?? DEFAULT_PAGE_LIMIT));
  }

  /** İmleç istemci için opaktır: `base64url(JSON([createdAt, id]))`. */
  private encodeCursor(key: SeekKey): string {
    return Buffer.from(JSON.stringify([key.createdAt, key.id])).toString(
      "base64url",
    );
  }

  private decodeCursor(cursor: string): SeekKey {
    try {
      const decoded: unknown = JSON.parse(
        Buffer.from(cursor, "base64url").toString("utf8"),
      );
      if (
        Array.isArray(decoded) &&
        decoded.length === 2 &&
        typeof decoded[0] === "string" &&
        TIMESTAMP_PATTERN.test(decoded[0]) &&
        Number.isSafeInteger(decoded[1])
      ) {
        return { createdAt: decoded[0], id: decoded[1] as number };
      }
    } catch {
      // aşağıdaki hataya düşer
    }
    throw new BadRequestException("Geçersiz sayfa imleci.");
  }

  private buildOffsetMeta(
    page: number,
    limit: number,
    totalDocs: number,
  ): PaginationMeta {
    const totalPages = Math.ceil(totalDocs / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      kind: "offset",
      page,
      limit,
      totalDocs,
      totalPages,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
      hasNextPage,
      hasPrevPage,
    };
  }
}
