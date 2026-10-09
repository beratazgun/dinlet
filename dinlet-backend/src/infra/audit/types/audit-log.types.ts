/** JSON'a serileştirilebilir, redakte edilmiş bir istek/yanıt parçası. */
export type AuditPayload = Record<string, unknown> | unknown[] | string | null;

/**
 * Tek bir HTTP isteğinin değiştirilemez denetim kaydı: kim, hangi uca, hangi
 * girdiyle geldi; sistem ne cevap verdi, ne kadar sürdü.
 */
export interface AuditLog {
  id: number;
  /** İstek korelasyon kimliği (`x-request-id`). */
  requestId: string;
  method: string;
  /** Route deseni (ör. `/api/v1/jobs/:code`); eşleşmeyen isteklerde null. */
  route: string | null;
  /** Query string dahil gerçek URL. */
  url: string;
  statusCode: number;
  durationMs: number;
  userId: number | null;
  roleCode: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  controller: string | null;
  handler: string | null;
  requestHeaders: AuditPayload;
  requestQuery: AuditPayload;
  requestParams: AuditPayload;
  requestBody: AuditPayload;
  responseBody: AuditPayload;
  changes: AuditPayload;
  errorMessage: string | null;
  /** ISO 8601 */
  createdAt: string;
}

export type NewAuditLog = Omit<AuditLog, "id" | "createdAt">;

/** Listeleme ekranı için gövdesiz, hafif projeksiyon. */
export type AuditLogSummary = Pick<
  AuditLog,
  | "id"
  | "requestId"
  | "method"
  | "route"
  | "url"
  | "statusCode"
  | "durationMs"
  | "userId"
  | "roleCode"
  | "ipAddress"
  | "errorMessage"
  | "createdAt"
>;

export interface AuditLogFilter {
  userId?: number;
  method?: string;
  statusCode?: number;
  /** `url` içinde (büyük/küçük harf duyarsız) geçen metin. */
  path?: string;
  requestId?: string;
  /** ISO 8601, dahil */
  from?: string;
  /** ISO 8601, dahil */
  to?: string;
  order?: "asc" | "desc";
}
