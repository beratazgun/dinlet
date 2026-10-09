import { UnauthorizedException } from "@nestjs/common";
import type { HasClearCookies } from "#/core/exceptions/cookie-clearing-exception.interface.js";
import type { ClearCookie } from "#/types/response/base-response.type.js";

/**
 * Oturum ele geçirme şüphesi veya benzeri bir güvenlik ihlalinde fırlatılır.
 * Global Exception Filter bu hatayı yakaladığında `clearCookies` listesindeki
 * cookie'leri temizler — böylece istemcide ölü bir oturum cookie'si kalmaz.
 */
export class SecurityBreachException
  extends UnauthorizedException
  implements HasClearCookies
{
  constructor(
    public readonly clearCookies: ClearCookie[],
    message?: string,
  ) {
    super(message || "Güvenlik ihlali algılandı. Tüm oturumlar sonlandırıldı.");
  }
}
