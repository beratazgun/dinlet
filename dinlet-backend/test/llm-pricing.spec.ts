import { describe, expect, it } from "vitest";

import { estimateCostUsd } from "#/infra/llm/llm-pricing.js";

const usage = (inputTokens: number, outputTokens: number) => ({
  inputTokens,
  outputTokens,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
});

describe("estimateCostUsd", () => {
  it("Haiku 5.5: 100K token'a kadar alt kademe", () => {
    // Tipik bölüm çağrısı: ~2.500 girdi, ~2.000 çıktı token.
    expect(estimateCostUsd("claude-haiku-5-5", usage(2_500, 2_000))).toBeCloseTo(
      (2_500 * 0.1 + 2_000 * 0.5) / 1e6,
    );
    expect(estimateCostUsd("claude-haiku-5-5", usage(100_000, 0))).toBeCloseTo(0.01);
  });

  it("Haiku 5.5: 100K üstü istemde tüm istek üst kademeden", () => {
    expect(estimateCostUsd("claude-haiku-5-5", usage(100_001, 1_000))).toBeCloseTo(
      (100_001 * 0.5 + 1_000 * 2.5) / 1e6,
    );
  });

  it("bilinmeyen model için null", () => {
    expect(estimateCostUsd("baska-model", usage(1, 1))).toBeNull();
  });
});
