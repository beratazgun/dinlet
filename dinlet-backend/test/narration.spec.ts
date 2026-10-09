import { describe, expect, it } from "vitest";

import {
  parseExtractJobId,
  parseTtsJobId,
} from "#/modules/document/queue/document-queue.events.js";
import { TtsQueueService } from "#/modules/document/queue/tts-queue.service.js";
import {
  parseScript,
  splitInHalf,
} from "#/modules/document/services/narration.service.js";

describe("parseScript", () => {
  it("şemaya uyan çıktıyı temizleyerek alır", () => {
    expect(
      parseScript({ paragraphs: [" Bir. ", "", "İki."], recap: " Bu bölümde… " }),
    ).toEqual({ paragraphs: ["Bir.", "İki."], recap: "Bu bölümde…" });
  });

  it("boş veya şemaya uymayan çıktıyı reddeder", () => {
    expect(parseScript({ paragraphs: [], recap: "x" })).toBeNull();
    expect(parseScript({ paragraphs: "metin" })).toBeNull();
    expect(parseScript(null)).toBeNull();
    expect(parseScript({ paragraphs: ["A."], recap: "" })).toEqual({
      paragraphs: ["A."],
      recap: null,
    });
  });
});

describe("splitInHalf", () => {
  it("ortaya en yakın paragraf sınırından böler", () => {
    const text = ["a".repeat(100), "b".repeat(100), "c".repeat(100), "d".repeat(100)].join("\n\n");
    const [first, second] = splitInHalf(text)!;
    expect(first.split("\n\n")).toHaveLength(2);
    expect(second.split("\n\n")).toHaveLength(2);
  });

  it("tek paragrafı bölmez", () => {
    expect(splitInHalf("tek paragraf")).toBeNull();
  });
});

describe("job kimlikleri", () => {
  it("extract ve tts kimliklerini çözer", () => {
    expect(parseExtractJobId("extract-42")).toBe(42);
    expect(parseExtractJobId("doc-42")).toBeNull();

    const ttsId = TtsQueueService.jobId(7, "0a1b2c3d4e5f6a7b", 2);
    expect(ttsId).not.toContain(":");
    expect(parseTtsJobId(ttsId)).toEqual({
      sectionId: 7,
      scriptHash: "0a1b2c3d4e5f6a7b",
    });
  });
});
