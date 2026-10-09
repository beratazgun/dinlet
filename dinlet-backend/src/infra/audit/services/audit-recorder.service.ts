import { Injectable, Logger } from "@nestjs/common";

import { AuditLogQueueService } from "#/infra/audit/queue/index.js";
import { toAuditPayload } from "#/infra/audit/utils/index.js";
import type { SessionUser } from "#/types/index.js";

export interface RecordHttpRequestInput {
  requestId: string;
  method: string;
  route: string | null;
  url: string;
  statusCode: number;
  durationMs: number;
  user: SessionUser | null;
  ipAddress: string | null;
  userAgent: string | null;
  controller: string | null;
  handler: string | null;
  headers: Record<string, unknown>;
  query: unknown;
  params: unknown;
  /** `undefined` → gövde bilerek kaydedilmiyor (`@AuditOptions`). */
  requestBody: unknown;
  responseBody: unknown;
  changes?: unknown;
  errorMessage: string | null;
}

/**
 * Tamamlanmış bir HTTP isteğinin denetim kaydını hazırlar (redaksiyon +
 * kırpma) ve kuyruğa alır.
 *
 * Denetim asla isteği bozmamalıdır: hata fırlatmaz, yalnızca loglar.
 */
@Injectable()
export class AuditRecorderService {
  private readonly logger = new Logger(AuditRecorderService.name);

  constructor(private readonly auditLogQueue: AuditLogQueueService) {}

  async recordHttpRequest(input: RecordHttpRequestInput): Promise<void> {
    try {
      await this.auditLogQueue.enqueue({
        requestId: input.requestId,
        method: input.method,
        route: input.route,
        url: input.url,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        userId: input.user?.id ?? null,
        roleCode: input.user?.role.code ?? null,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        controller: input.controller,
        handler: input.handler,
        requestHeaders: toAuditPayload(input.headers),
        requestQuery: toAuditPayload(input.query),
        requestParams: toAuditPayload(input.params, { redact: false }),
        requestBody: toAuditPayload(input.requestBody),
        responseBody: toAuditPayload(input.responseBody),
        changes: toAuditPayload(input.changes),
        errorMessage: input.errorMessage,
      });
    } catch (error) {
      this.logger.error(
        `Denetim kaydı kuyruğa alınamadı (${input.method} ${input.url}, ${input.requestId}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
