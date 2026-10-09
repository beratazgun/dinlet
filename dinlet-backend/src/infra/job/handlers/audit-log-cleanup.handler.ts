import { Injectable } from "@nestjs/common";

import { DateManager } from "#/core/utils/date-manager.js";
import type {
  AbstractJobHandler,
  JobExecutionResult,
  JobParams,
} from "#/infra/job/handlers/abstract.handler.js";
import { DatabaseService } from "#database/database.service.js";

const DEFAULT_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * Saklama süresini (`params.retentionDays`, varsayılan 90 gün) aşan denetim
 * kayıtlarını siler. Süre `Job.params` üzerinden redeploy'suz değiştirilir.
 */
@Injectable()
export class AuditLogCleanupHandler implements AbstractJobHandler {
  constructor(
    private readonly database: DatabaseService,
    private readonly dateManager: DateManager,
  ) {}

  getJobCode(): string {
    return "AUDIT_LOG_CLEANUP";
  }

  async execute(params: JobParams = {}): Promise<JobExecutionResult> {
    const retentionDays =
      typeof params.retentionDays === "number" && params.retentionDays > 0
        ? params.retentionDays
        : DEFAULT_RETENTION_DAYS;
    const cutoff = this.dateManager.toISOString(
      this.dateManager.addMilliseconds(-retentionDays * DAY_MS),
    );
    // Tek sorgu; RETURNING yok — silinen (büyük) satırlar belleğe okunmaz.
    const deleted = await this.database.client.orm.public.AuditLog.where(
      (log) => log.createdAt.lt(cutoff),
    ).deleteAndCount();

    return { affectedRows: deleted, metadata: { retentionDays, cutoff } };
  }
}
