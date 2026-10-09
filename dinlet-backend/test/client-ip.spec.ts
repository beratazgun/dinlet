import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { resolveClientIp } from "#/core/decorators/request-metadata.decorator.js";

const request = (headers: Record<string, string>, remote = "10.0.0.1") =>
  ({ headers, socket: { remoteAddress: remote }, ip: remote }) as unknown as FastifyRequest;

describe("resolveClientIp", () => {
  it("Cloudflare başlığını sahtelenebilir x-forwarded-for'a tercih eder", () => {
    expect(
      resolveClientIp(
        request({
          "cf-connecting-ip": "203.0.113.7",
          "x-forwarded-for": "1.2.3.4, 203.0.113.7, 172.70.0.1",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  it("Cloudflare yoksa x-forwarded-for'un ilk adresini, o da yoksa soketi kullanır", () => {
    expect(resolveClientIp(request({ "x-forwarded-for": " 1.2.3.4 , 5.6.7.8" }))).toBe("1.2.3.4");
    expect(resolveClientIp(request({}))).toBe("10.0.0.1");
  });
});
