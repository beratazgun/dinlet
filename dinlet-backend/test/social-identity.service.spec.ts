import { createHash } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { jwtVerify, verifyIdToken } = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
  verifyIdToken: vi.fn(),
}));

vi.mock("jose", () => ({ createRemoteJWKSet: vi.fn(), jwtVerify }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));

import { SocialIdentityService } from "#/modules/auth/services/social-identity.service.js";
import type { EnvType } from "#config/env.validation.js";

const config = {
  getOrThrow: (key: string) =>
    key === "GOOGLE_CLIENT_IDS" ? "ios-id, android-id" : "com.dinlet.app",
} as unknown as ConfigService<EnvType>;

describe("SocialIdentityService", () => {
  let service: SocialIdentityService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SocialIdentityService(config);
  });

  describe("Apple", () => {
    const payload = (nonce: string) => ({
      payload: {
        sub: "apple-sub",
        email: "a@privaterelay.appleid.com",
        email_verified: "true",
        nonce,
      },
    });

    it("ham veya SHA-256 özetli nonce'u kabul eder, metin boolean'ı çözer", async () => {
      const hashed = createHash("sha256").update("raw-nonce").digest("hex");
      for (const claim of ["raw-nonce", hashed]) {
        jwtVerify.mockResolvedValueOnce(payload(claim));
        const profile = await service.verifyApple("token", "raw-nonce", {
          name: " Ayşe ",
        });
        expect(profile).toMatchObject({
          provider: "APPLE",
          providerAccountId: "apple-sub",
          isEmailVerified: true,
          name: "Ayşe",
          surname: null,
        });
      }
      expect(jwtVerify).toHaveBeenCalledWith("token", undefined, {
        issuer: "https://appleid.apple.com",
        audience: ["com.dinlet.app"],
      });
    });

    it("nonce eşleşmezse reddeder", async () => {
      jwtVerify.mockResolvedValueOnce(payload("baska"));
      await expect(service.verifyApple("token", "raw-nonce")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("imza doğrulanamazsa reddeder", async () => {
      jwtVerify.mockRejectedValueOnce(new Error("signature"));
      await expect(service.verifyApple("token", "n")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("Google", () => {
    it("audience listesiyle doğrular ve profili çıkarır", async () => {
      verifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: "g-sub",
          email: "x@gmail.com",
          email_verified: true,
          given_name: "Ali",
          family_name: "Veli",
        }),
      });

      await expect(service.verifyGoogle("id-token")).resolves.toEqual({
        provider: "GOOGLE",
        providerAccountId: "g-sub",
        email: "x@gmail.com",
        isEmailVerified: true,
        name: "Ali",
        surname: "Veli",
      });
      expect(verifyIdToken).toHaveBeenCalledWith({
        idToken: "id-token",
        audience: ["ios-id", "android-id"],
      });
    });

    it("geçersiz token'ı reddeder", async () => {
      verifyIdToken.mockRejectedValueOnce(new Error("Wrong recipient"));
      await expect(service.verifyGoogle("x")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
