import { Injectable } from "@nestjs/common";
import type { JsonValue } from "@prisma/orm-postgres/target/codec-types";

import type { CursorWindow } from "#/core/utils/paginator.js";
import type {
  AuditLog,
  AuditLogFilter,
  AuditLogSummary,
  AuditPayload,
  NewAuditLog,
} from "#/infra/audit/types/index.js";
import { DatabaseService } from "#database/database.service.js";

const SUMMARY_FIELDS = [
  "id",
  "requestId",
  "method",
  "route",
  "url",
  "statusCode",
  "durationMs",
  "userId",
  "roleCode",
  "ipAddress",
  "errorMessage",
  "createdAt",
] as const;

/**
 * Denetim kayıtları. Kayıtlar yalnızca eklenir; güncelleme veya tekil silme
 * metodu bilerek YOKTUR (eski kayıtları `AUDIT_LOG_CLEANUP` job'ı siler).
 */
@Injectable()
export class AuditLogRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  async save(entry: NewAuditLog): Promise<void> {
    await this.saveMany([entry]);
  }

  /** Tek çok satırlı INSERT ile toplu yazım (RETURNING yok). */
  async saveMany(entries: NewAuditLog[]): Promise<void> {
    if (entries.length === 0) return;
    // `createAndCount` RETURNING üretmez: büyük gövdeli satırlar geri okunmaz.
    await this.db.orm.public.AuditLog.createAndCount(
      entries.map((entry) => this.toRow(entry)),
    );
  }

  /**
   * `(createdAt, id)` sırasıyla keyset sayfası; `COUNT` çalıştırmaz.
   * `after` konumundan sonraki (sıralama yönünde) `limit` kaydı döner.
   */
  async findPage(
    filter: AuditLogFilter,
    window: CursorWindow,
  ): Promise<AuditLogSummary[]> {
    const isAsc = filter.order === "asc";
    let query = this.filtered(filter);
    const after = window.after;
    if (after) {
      // `.cursor()` `a < x OR (a = x AND id < y)` üretir; Postgres bu OR'dan
      // index sınırı çıkaramaz. Bu fazladan koşul index taramasını doğrudan
      // imleç konumundan başlatır (derin sayfalar da O(limit) kalır).
      query = query.where((log) =>
        isAsc
          ? log.createdAt.gte(after.createdAt)
          : log.createdAt.lte(after.createdAt),
      );
    }
    return await query
      .select(...SUMMARY_FIELDS)
      .orderBy(
        isAsc
          ? [(log) => log.createdAt.asc(), (log) => log.id.asc()]
          : [(log) => log.createdAt.desc(), (log) => log.id.desc()],
      )
      // Boş imleç no-op'tur: ilk sayfa.
      .cursor(after ?? {})
      .limit(window.limit)
      .all();
  }

  async findById(id: number): Promise<AuditLog | null> {
    const row = await this.db.orm.public.AuditLog.where({ id }).first();
    if (!row) return null;

    return {
      ...row,
      requestHeaders: row.requestHeaders as AuditPayload,
      requestQuery: row.requestQuery as AuditPayload,
      requestParams: row.requestParams as AuditPayload,
      requestBody: row.requestBody as AuditPayload,
      responseBody: row.responseBody as AuditPayload,
      changes: (row.changes ?? null) as AuditPayload,
    };
  }

  /** Verilen filtre alanlarını AND ile birleştiren sorgu. */
  private filtered(filter: AuditLogFilter) {
    let query = this.db.orm.public.AuditLog.where((log) => log.id.gt(0));
    if (filter.userId !== undefined) {
      query = query.where({ userId: filter.userId });
    }
    if (filter.method) {
      query = query.where({ method: filter.method.toUpperCase() });
    }
    if (filter.statusCode !== undefined) {
      query = query.where({ statusCode: filter.statusCode });
    }
    if (filter.requestId) {
      query = query.where({ requestId: filter.requestId });
    }
    if (filter.path) {
      const pattern = `%${filter.path.replace(/[%_]/g, "\\$&")}%`;
      query = query.where((log) => log.url.ilike(pattern));
    }
    if (filter.from) {
      const from = filter.from;
      query = query.where((log) => log.createdAt.gte(from));
    }
    if (filter.to) {
      const to = filter.to;
      query = query.where((log) => log.createdAt.lte(to));
    }
    return query;
  }

  private toRow(entry: NewAuditLog) {
    return {
      ...entry,
      requestHeaders: this.toJson(entry.requestHeaders),
      requestQuery: this.toJson(entry.requestQuery),
      requestParams: this.toJson(entry.requestParams),
      requestBody: this.toJson(entry.requestBody),
      responseBody: this.toJson(entry.responseBody),
      changes: this.toJson(entry.changes),
    };
  }

  private toJson(value: AuditPayload): JsonValue | null {
    return value as JsonValue | null;
  }
}
