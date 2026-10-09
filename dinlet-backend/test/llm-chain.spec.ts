import type { ConfigService } from "@nestjs/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LlmService } from "#/infra/llm/llm.service.js";
import type { AnthropicProvider } from "#/infra/llm/providers/anthropic.provider.js";
import {
  GeminiProvider,
  toGeminiSchema,
} from "#/infra/llm/providers/gemini.provider.js";
import {
  EMPTY_USAGE,
  type LlmProvider,
  type ProviderResult,
} from "#/infra/llm/providers/llm-provider.js";
import { MistralProvider } from "#/infra/llm/providers/mistral.provider.js";
import type { EnvType } from "#config/env.validation.js";

const REQUEST = { system: "s", content: "c", schema: { type: "object" } };

const config = (values: Record<string, unknown>) =>
  ({
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  }) as unknown as ConfigService<EnvType>;

function fakeProvider(
  name: LlmProvider["name"],
  models: string[],
  results: Record<string, ProviderResult[]>,
): LlmProvider & { generate: ReturnType<typeof vi.fn> } {
  return {
    name,
    models,
    isConfigured: true,
    generate: vi.fn(async ({ model }: { model: string }) => {
      const queue = results[model]!;
      return queue.length > 1 ? queue.shift()! : queue[0]!;
    }),
  };
}

const ok = (data: unknown): ProviderResult => ({ kind: "ok", data, usage: EMPTY_USAGE });
const quota = (retryAfterMs?: number): ProviderResult => ({
  kind: "unavailable",
  reason: "429 RESOURCE_EXHAUSTED",
  retryAfterMs,
});

function chain(gemini: LlmProvider, mistral: LlmProvider, anthropic: LlmProvider) {
  return new LlmService(
    config({
      LLM_PROVIDER_CHAIN: "gemini,mistral,anthropic",
      LLM_MAX_TOKENS: 1000,
      LLM_QUOTA_COOLDOWN_SECONDS: 60,
    }),
    gemini as unknown as GeminiProvider,
    mistral as unknown as MistralProvider,
    anthropic as unknown as AnthropicProvider,
  );
}

describe("LlmService zinciri", () => {
  it("Gemini kotası dolunca sıradaki Gemini modeline, o da dolunca Mistral'e geçer", async () => {
    const gemini = fakeProvider("gemini", ["g1", "g2"], { g1: [quota()], g2: [quota()] });
    const mistral = fakeProvider("mistral", ["m1"], { m1: [ok({ a: 1 })] });
    const anthropic = fakeProvider("anthropic", ["c1"], { c1: [ok({})] });

    const result = await chain(gemini, mistral, anthropic).generateStructured(REQUEST);

    expect(result).toMatchObject({ kind: "ok", data: { a: 1 }, model: "mistral:m1" });
    expect(gemini.generate).toHaveBeenCalledTimes(2);
    expect(anthropic.generate).not.toHaveBeenCalled();
  });

  it("kotası dolan modeli dinlendirme süresince atlar", async () => {
    const gemini = fakeProvider("gemini", ["g1"], { g1: [quota(30_000), ok({ again: true })] });
    const mistral = fakeProvider("mistral", ["m1"], { m1: [ok({ from: "mistral" })] });
    const anthropic = fakeProvider("anthropic", ["c1"], { c1: [ok({})] });
    const service = chain(gemini, mistral, anthropic);

    await service.generateStructured(REQUEST);
    const second = await service.generateStructured(REQUEST);

    expect(second).toMatchObject({ model: "mistral:m1" });
    expect(gemini.generate).toHaveBeenCalledTimes(1);
  });

  it("hepsi başarısız olursa Claude'a, o da olmazsa hataya düşer", async () => {
    const down: ProviderResult = { kind: "unavailable", reason: "503" };
    const gemini = fakeProvider("gemini", ["g1"], { g1: [down] });
    const mistral = fakeProvider("mistral", ["m1"], { m1: [down] });
    const anthropic = fakeProvider("anthropic", ["c1"], { c1: [ok({ by: "claude" })] });
    expect(
      await chain(gemini, mistral, anthropic).generateStructured(REQUEST),
    ).toMatchObject({ model: "anthropic:c1" });

    const anthropicDown = fakeProvider("anthropic", ["c1"], { c1: [down] });
    await expect(
      chain(gemini, mistral, anthropicDown).generateStructured(REQUEST),
    ).rejects.toThrow("Hiçbir LLM sağlayıcısı");
  });

  it("güvenlik reddinde aynı sağlayıcının diğer modellerini atlar", async () => {
    const refusal: ProviderResult = { kind: "refusal", reason: "SAFETY", usage: EMPTY_USAGE };
    const gemini = fakeProvider("gemini", ["g1", "g2"], { g1: [refusal], g2: [ok({})] });
    const mistral = fakeProvider("mistral", ["m1"], { m1: [refusal] });
    const anthropic = fakeProvider("anthropic", ["c1"], { c1: [refusal] });

    const result = await chain(gemini, mistral, anthropic).generateStructured(REQUEST);

    expect(result.kind).toBe("refusal");
    expect(result.usages).toHaveLength(3);
    expect(gemini.generate).toHaveBeenCalledTimes(1);
  });

  it("anahtarı olmayan sağlayıcı zincirden düşer", async () => {
    const gemini = { ...fakeProvider("gemini", ["g1"], { g1: [ok({})] }), isConfigured: false };
    const mistral = fakeProvider("mistral", ["m1"], { m1: [ok({ m: 1 })] });
    const anthropic = fakeProvider("anthropic", ["c1"], { c1: [ok({})] });

    const result = await chain(gemini, mistral, anthropic).generateStructured(REQUEST);
    expect(result).toMatchObject({ model: "mistral:m1" });
    expect(gemini.generate).not.toHaveBeenCalled();
  });
});

describe("sağlayıcı yanıtları", () => {
  const request = { ...REQUEST, model: "x", maxTokens: 100 };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });

  it("Gemini: düşünme parçalarını atar, JSON'u ayrıştırır", async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: "düşünce", thought: true }, { text: '{"a":1}' }] },
          },
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 3 },
      }),
    );
    const provider = new GeminiProvider(config({ GEMINI_API_KEY: "k", GEMINI_LLM_MODELS: "x" }));
    expect(await provider.generate(request)).toEqual({
      kind: "ok",
      data: { a: 1 },
      usage: { inputTokens: 10, outputTokens: 8, cacheReadTokens: 0, cacheWriteTokens: 0 },
    });
  });

  it("Gemini: günlük kota bir saat, dakikalık kota bildirilen süre dinlendirilir", async () => {
    const provider = new GeminiProvider(config({ GEMINI_API_KEY: "k", GEMINI_LLM_MODELS: "x" }));
    fetchMock.mockResolvedValueOnce(
      json(429, {
        error: {
          status: "RESOURCE_EXHAUSTED",
          details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel" }] }],
        },
      }),
    );
    expect(await provider.generate(request)).toMatchObject({ retryAfterMs: 3_600_000 });

    fetchMock.mockResolvedValueOnce(
      json(429, { error: { details: [{ retryDelay: "37s" }] } }),
    );
    expect(await provider.generate(request)).toMatchObject({ retryAfterMs: 37_000 });
  });

  it("Gemini: güvenlik engelini ret, MAX_TOKENS'ı kesik sayar", async () => {
    const provider = new GeminiProvider(config({ GEMINI_API_KEY: "k", GEMINI_LLM_MODELS: "x" }));
    fetchMock.mockResolvedValueOnce(json(200, { promptFeedback: { blockReason: "SAFETY" } }));
    expect((await provider.generate(request)).kind).toBe("refusal");
    fetchMock.mockResolvedValueOnce(json(200, { candidates: [{ finishReason: "MAX_TOKENS" }] }));
    expect((await provider.generate(request)).kind).toBe("max_tokens");
  });

  it("Mistral: JSON çıktı, 429'da Retry-After", async () => {
    const provider = new MistralProvider(config({ MISTRAL_API_KEY: "k", MISTRAL_LLM_MODELS: "x" }));
    fetchMock.mockResolvedValueOnce(
      json(200, {
        choices: [{ finish_reason: "stop", message: { content: '```json\n{"b":2}\n```' } }],
        usage: { prompt_tokens: 4, completion_tokens: 2 },
      }),
    );
    expect(await provider.generate(request)).toMatchObject({ kind: "ok", data: { b: 2 } });

    fetchMock.mockResolvedValueOnce(json(429, { message: "rate" }, { "retry-after": "12" }));
    expect(await provider.generate(request)).toMatchObject({
      kind: "unavailable",
      retryAfterMs: 12_000,
    });
  });

  it("JSON Schema'yı Gemini biçimine çevirir", () => {
    expect(
      toGeminiSchema({
        type: "object",
        properties: { paragraphs: { type: "array", items: { type: "string" } } },
        required: ["paragraphs"],
        additionalProperties: false,
      }),
    ).toEqual({
      type: "OBJECT",
      properties: { paragraphs: { type: "ARRAY", items: { type: "STRING" } } },
      required: ["paragraphs"],
    });
  });
});
