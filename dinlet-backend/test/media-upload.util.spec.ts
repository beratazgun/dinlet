import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import {
  assertUploadAllowed,
  extensionFor,
} from "#/modules/media/utils/index.js";

describe("media-upload.util", () => {
  it("PDF'i ve sınırdaki boyutu kabul eder", () => {
    expect(() =>
      assertUploadAllowed({ mimeType: "application/pdf", size: 1 }, 10),
    ).not.toThrow();
    expect(() =>
      assertUploadAllowed({ mimeType: "application/pdf", size: 10 }, 10),
    ).not.toThrow();
  });

  it.each([
    { mimeType: "image/png", size: 5 },
    { mimeType: "text/html", size: 5 },
    { mimeType: "application/pdf", size: 0 },
    { mimeType: "application/pdf", size: 11 },
  ])("geçersiz yüklemeyi reddeder: %o", (candidate) => {
    expect(() => assertUploadAllowed(candidate, 10)).toThrow(
      BadRequestException,
    );
  });

  it("MIME türünden uzantı üretir", () => {
    expect(extensionFor("application/pdf")).toBe("pdf");
    expect(() => extensionFor("application/zip")).toThrow(BadRequestException);
  });
});
