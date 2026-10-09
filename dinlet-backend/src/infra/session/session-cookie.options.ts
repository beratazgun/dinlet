import type { CookieSerializeOptions } from "@fastify/cookie";
import type { ConfigService } from "@nestjs/config";
import { isIP } from "node:net";
import type { EnvType } from "#config/env.validation.js";

/**
 * Cookie'nin geçerli olacağı domain'i frontend URL'inden türetir.
 * `localhost` ve IP adreslerinde domain verilmez (tarayıcı reddeder).
 */
function resolveCookieDomain(
  configService: ConfigService<EnvType>,
): string | undefined {
  const frontendUrl = configService.get("FRONTEND_URL", { infer: true });
  if (!frontendUrl) return undefined;

  try {
    const hostname = new URL(frontendUrl).hostname;
    if (!hostname || hostname === "localhost" || isIP(hostname)) {
      return undefined;
    }

    const parts = hostname.split(".").filter(Boolean);
    return parts.length < 2 ? undefined : `.${parts.slice(-2).join(".")}`;
  } catch {
    return undefined;
  }
}

/**
 * Oturum cookie'sinin temel nitelikleri.
 *
 * `maxAge` içermez; `@fastify/session` kaydında milisaniye, `clearCookie`
 * çağrılarında ise hiç gerekmediği için süreyi çağıran taraf ekler.
 */
export function buildSessionCookieOptions(
  configService: ConfigService<EnvType>,
  overrides: CookieSerializeOptions = {},
): CookieSerializeOptions {
  const domain = resolveCookieDomain(configService);

  return {
    httpOnly: true,
    secure: configService.get("NODE_ENV", { infer: true }) === "production",
    sameSite: "lax",
    path: "/",
    ...(domain ? { domain } : {}),
    ...overrides,
  };
}

/**
 * Oturum cookie'sini silmek için kullanılacak seçenekler.
 * Tarayıcının doğru cookie'yi silebilmesi için `path`/`domain` yazma
 * anındakiyle birebir aynı olmalıdır.
 */
export function buildSessionClearCookieOptions(
  configService: ConfigService<EnvType>,
): CookieSerializeOptions {
  return buildSessionCookieOptions(configService);
}
