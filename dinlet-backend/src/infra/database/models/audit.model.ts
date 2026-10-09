import {
  autoIncrementId,
  type ModelHelpers,
} from "#database/models/model.types.js";

/**
 * HTTP denetim kaydı (audit trail). Her istek için bir satır; kayıtlar
 * değiştirilmez/silinmez — yalnızca retention job'ı eski kayıtları temizler.
 *
 * `userId` bilerek FK değildir: kullanıcı silinse bile iz kalmalıdır.
 */
export function createAuditModels({ field, model }: ModelHelpers) {
  const AuditLog = model("AuditLog", {
    fields: {
      id: autoIncrementId(field),
      requestId: field.text().column("request_id"),
      method: field.text(),
      /** Route deseni (ör. `/api/v1/jobs/:code`); eşleşmeyen isteklerde null. */
      route: field.text().optional(),
      /** Query string dahil gerçek URL. */
      url: field.text(),
      statusCode: field.int().column("status_code"),
      durationMs: field.int().column("duration_ms"),
      userId: field.int().optional().column("user_id"),
      roleCode: field.text().optional().column("role_code"),
      ipAddress: field.text().optional().column("ip_address"),
      userAgent: field.text().optional().column("user_agent"),
      controller: field.text().optional(),
      handler: field.text().optional(),
      requestHeaders: field.json().optional().column("request_headers"),
      requestQuery: field.json().optional().column("request_query"),
      requestParams: field.json().optional().column("request_params"),
      requestBody: field.json().optional().column("request_body"),
      responseBody: field.json().optional().column("response_body"),
      changes: field.json().optional().column("changes"),
      errorMessage: field.text().optional().column("error_message"),
      createdAt: field.temporal.createdAtString().column("created_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "audit_logs",
    indexes: [
      constraints.index([cols.createdAt]),
      constraints.index([cols.userId, cols.createdAt]),
      constraints.index([cols.route, cols.method]),
      constraints.index([cols.statusCode]),
      constraints.index([cols.requestId]),
    ],
  }));

  return { AuditLog };
}
