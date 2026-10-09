import { SetMetadata } from "@nestjs/common";

import { AUDIT_OPTIONS_KEY } from "#/core/constants/index.js";

export interface AuditRouteOptions {
  /** false → bu uç hiç denetim kaydı üretmez (ör. health check). */
  enabled?: boolean;
  /** false → istek gövdesi kaydedilmez (büyük/ikili yüklemeler). */
  captureRequestBody?: boolean;
  /** false → yanıt gövdesi kaydedilmez (büyük listeler, audit okumaları). */
  captureResponseBody?: boolean;
}

/**
 * Bir controller'ın veya ucun denetim (audit) davranışını ayarlar.
 * Varsayılan: her uç, istek ve yanıt gövdesiyle birlikte kaydedilir.
 *
 * @example
 * @AuditOptions({ enabled: false })              // health check
 * @AuditOptions({ captureResponseBody: false })  // büyük liste yanıtı
 */
export const AuditOptions = (options: AuditRouteOptions) =>
  SetMetadata(AUDIT_OPTIONS_KEY, options);
