import { Injectable, NotFoundException } from "@nestjs/common";

import { OkResponse } from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { Paginator } from "#/core/utils/paginator.js";
import type { AuditLogListQueryDto } from "#/infra/audit/dtos/index.js";
import { AuditLogRepository } from "#/infra/audit/repository/index.js";

const END_OF_DAY_MS = 24 * 60 * 60 * 1_000 - 1;

/** Denetim kayıtlarını okuma (salt okunur). */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly paginator: Paginator,
    private readonly dateManager: DateManager,
  ) {}

  /**
   * Denetim kayıtlarını filtreleyip (varsayılan: en yeni önce) imleçle sayfalar.
   * Tablo sürekli büyüdüğü için `COUNT`/`OFFSET` yerine keyset kullanılır.
   */
  async list(query: AuditLogListQueryDto): Promise<OkResponse> {
    const filter = {
      order: query.order,
      userId: query.userId,
      method: query.method,
      statusCode: query.statusCode,
      path: query.path,
      requestId: query.requestId,
      from: query.dateFrom && this.dateManager.toISOString(query.dateFrom),
      // `dateTo` gün olarak gelir; o günün sonuna kadar dahil edilir.
      to:
        query.dateTo &&
        this.dateManager.toISOString(
          this.dateManager.addMilliseconds(END_OF_DAY_MS, query.dateTo),
        ),
    };

    const { docs, pagination } = await this.paginator.applyCursor({
      cursor: query.cursor,
      limit: query.limit,
      query: (window) => this.auditLogRepository.findPage(filter, window),
    });

    return new OkResponse("Denetim kayıtları listelendi", docs, {
      meta: { pagination },
    });
  }

  /** Tek bir denetim kaydını istek/yanıt gövdeleriyle birlikte getirir. */
  async get(id: number): Promise<OkResponse> {
    const log = await this.auditLogRepository.findById(id);
    if (!log) throw new NotFoundException(`Denetim kaydı bulunamadı: ${id}`);

    return new OkResponse("Denetim kaydı getirildi", log);
  }
}
