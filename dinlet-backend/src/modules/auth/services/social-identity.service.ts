import { createHash } from "node:crypto";

import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, jwtVerify } from "jose";

import type { EnvType } from "#config/env.validation.js";
import type { SocialProfile } from "#/modules/auth/types/index.js";
import { AccountType } from "#database/enums.js";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = new URL("https://appleid.apple.com/auth/keys");

/** Apple bazı boolean claim'leri `"true"` metni olarak gönderir. */
function isTrueClaim(value: unknown): boolean {
  return value === true || value === "true";
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Mobil yerel giriş SDK'larından gelen imzalı kimlik token'larını doğrular.
 *
 * - **Google:** `idToken` Google'ın anahtarlarıyla doğrulanır; `aud`
 *   değerinin bizim iOS/Android/web client ID'lerimizden biri olması gerekir.
 * - **Apple:** `identityToken` Apple JWKS'iyle doğrulanır (`iss`, `aud` =
 *   bundle ID). `nonce` istemcinin gönderdiği değerle ya da onun SHA-256
 *   özetiyle eşleşmelidir (istemci kütüphaneleri ikisinden birini kullanır).
 */
@Injectable()
export class SocialIdentityService {
  private readonly logger = new Logger(SocialIdentityService.name);
  private readonly googleClient = new OAuth2Client();
  private readonly appleJwks = createRemoteJWKSet(APPLE_JWKS_URL);
  private readonly googleAudiences: string[];
  private readonly appleAudiences: string[];

  constructor(configService: ConfigService<EnvType>) {
    const list = (key: "GOOGLE_CLIENT_IDS" | "APPLE_CLIENT_IDS") =>
      configService
        .getOrThrow(key, { infer: true })
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    this.googleAudiences = list("GOOGLE_CLIENT_IDS");
    this.appleAudiences = list("APPLE_CLIENT_IDS");
  }

  async verifyGoogle(idToken: string): Promise<SocialProfile> {
    const payload = await this.googleClient
      .verifyIdToken({ idToken, audience: this.googleAudiences })
      .then((ticket) => ticket.getPayload())
      .catch((error: unknown) => this.reject("Google", error));
    if (!payload?.sub) return this.reject("Google", "sub claim'i yok");

    return {
      provider: AccountType.GOOGLE,
      providerAccountId: payload.sub,
      email: optionalString(payload.email),
      isEmailVerified: payload.email_verified === true,
      name: optionalString(payload.given_name),
      surname: optionalString(payload.family_name),
    };
  }

  /**
   * Apple ad-soyadı token'a koymaz; yalnızca ilk girişte istemciye verir.
   * Bu yüzden istemcinin ilettiği ad-soyad profile eklenir.
   */
  async verifyApple(
    identityToken: string,
    nonce: string,
    fullName: { name?: string | null; surname?: string | null } = {},
  ): Promise<SocialProfile> {
    const { payload } = await jwtVerify(identityToken, this.appleJwks, {
      issuer: APPLE_ISSUER,
      audience: this.appleAudiences,
    }).catch((error: unknown) => this.reject("Apple", error));

    const hashedNonce = createHash("sha256").update(nonce).digest("hex");
    if (payload.nonce !== nonce && payload.nonce !== hashedNonce) {
      return this.reject("Apple", "nonce eşleşmedi");
    }
    if (!payload.sub) return this.reject("Apple", "sub claim'i yok");

    return {
      provider: AccountType.APPLE,
      providerAccountId: payload.sub,
      email: optionalString(payload.email),
      isEmailVerified: isTrueClaim(payload.email_verified),
      name: optionalString(fullName.name),
      surname: optionalString(fullName.surname),
    };
  }

  private reject(provider: string, reason: unknown): never {
    this.logger.warn(
      `${provider} kimlik token'ı reddedildi: ${reason instanceof Error ? reason.message : String(reason)}`,
    );
    throw new UnauthorizedException(`${provider} ile giriş doğrulanamadı.`);
  }
}
