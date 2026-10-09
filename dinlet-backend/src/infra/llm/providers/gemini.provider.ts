import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvType } from "#config/env.validation.js";
import {
  EMPTY_USAGE,
  parseJsonText,
  parseList,
  type LlmProvider,
  type ProviderRequest,
  type ProviderResult,
} from "#/infra/llm/providers/llm-provider.js";

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 120_000;
/** Günlük kota bittiğinde model bu süre dinlendirilir (saatte bir yeniden bakılır). */
const DAILY_QUOTA_COOLDOWN_MS = 60 * 60 * 1_000;

const REFUSAL_REASONS = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
]);

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
  };
}

interface GeminiError {
  error?: {
    status?: string;
    message?: string;
    details?: {
      "@type"?: string;
      retryDelay?: string;
      violations?: { quotaId?: string }[];
    }[];
  };
}

/**
 * Google Gemini (`generateContent`, REST). JSON çıktısı `responseSchema` ile
 * zorlanır. Kota aşımında (429 `RESOURCE_EXHAUSTED`) sunucunun bildirdiği
 * bekleme süresi, günlük kotada bir saat döner.
 */
@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = "gemini" as const;
  readonly models: string[];
  private readonly apiKey?: string;

  constructor(configService: ConfigService<EnvType>) {
    this.apiKey = configService.get("GEMINI_API_KEY", { infer: true });
    this.models = parseList(configService.get("GEMINI_LLM_MODELS", { infer: true }));
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey) && this.models.length > 0;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    let response: Response;
    try {
      response = await fetch(
        `${API_URL}/${encodeURIComponent(request.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": this.apiKey!,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.system }] },
            contents: [{ role: "user", parts: [{ text: request.content }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: toGeminiSchema(request.schema),
              maxOutputTokens: request.maxTokens,
            },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch (error) {
      return { kind: "unavailable", reason: `ağ hatası: ${String(error)}` };
    }

    if (!response.ok) return this.toUnavailable(response);

    const body = (await response.json()) as GeminiResponse;
    const usage = {
      ...EMPTY_USAGE,
      inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
      // Düşünme token'ları da çıktı olarak ücretlendirilir.
      outputTokens:
        (body.usageMetadata?.candidatesTokenCount ?? 0) +
        (body.usageMetadata?.thoughtsTokenCount ?? 0),
      cacheReadTokens: body.usageMetadata?.cachedContentTokenCount ?? 0,
    };

    if (body.promptFeedback?.blockReason) {
      return { kind: "refusal", reason: body.promptFeedback.blockReason, usage };
    }
    const candidate = body.candidates?.[0];
    const finishReason = candidate?.finishReason ?? "";
    if (REFUSAL_REASONS.has(finishReason)) {
      return { kind: "refusal", reason: finishReason, usage };
    }
    if (finishReason === "MAX_TOKENS") return { kind: "max_tokens", usage };

    const text = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("");
    try {
      return { kind: "ok", data: parseJsonText(text), usage };
    } catch {
      return { kind: "unavailable", reason: "JSON olmayan çıktı", usage };
    }
  }

  private async toUnavailable(response: Response): Promise<ProviderResult> {
    const body = (await response.json().catch(() => ({}))) as GeminiError;
    const reason = `${response.status} ${body.error?.status ?? ""} ${body.error?.message ?? ""}`.trim();
    if (response.status !== 429) return { kind: "unavailable", reason };

    const details = body.error?.details ?? [];
    const isDaily = details.some((detail) =>
      detail.violations?.some((violation) => violation.quotaId?.includes("PerDay")),
    );
    const delay = details.find((detail) => detail.retryDelay)?.retryDelay;
    const seconds = delay ? Number.parseFloat(delay) : Number.NaN;
    return {
      kind: "unavailable",
      reason,
      retryAfterMs: isDaily
        ? DAILY_QUOTA_COOLDOWN_MS
        : Number.isFinite(seconds)
          ? seconds * 1_000
          : undefined,
    };
  }
}

/**
 * Standart JSON Schema → Gemini `Schema` (OpenAPI alt kümesi): tipler büyük
 * harf, `additionalProperties` desteklenmez.
 */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (typeof schema !== "object" || schema === null) return schema;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    if (key === "type" && typeof value === "string") {
      result.type = value.toUpperCase();
    } else if (key === "properties" && typeof value === "object" && value !== null) {
      result.properties = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [name, toGeminiSchema(child)]),
      );
    } else {
      result[key] = toGeminiSchema(value);
    }
  }
  return result;
}
