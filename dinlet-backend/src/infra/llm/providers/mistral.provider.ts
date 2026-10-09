import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvType } from "#config/env.validation.js";
import {
  EMPTY_USAGE,
  parseJsonText,
  parseList,
  retryAfterHeaderMs,
  type LlmProvider,
  type ProviderRequest,
  type ProviderResult,
} from "#/infra/llm/providers/llm-provider.js";

const API_URL = "https://api.mistral.ai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 120_000;

interface MistralResponse {
  choices?: {
    message?: { content?: string | { type?: string; text?: string }[] };
    finish_reason?: string;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Mistral (`/v1/chat/completions`, REST). JSON çıktısı `json_schema`
 * response_format ile zorlanır. 429'da `Retry-After` başlığı kullanılır.
 */
@Injectable()
export class MistralProvider implements LlmProvider {
  readonly name = "mistral" as const;
  readonly models: string[];
  private readonly apiKey?: string;

  constructor(configService: ConfigService<EnvType>) {
    this.apiKey = configService.get("MISTRAL_API_KEY", { infer: true });
    this.models = parseList(configService.get("MISTRAL_LLM_MODELS", { infer: true }));
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey) && this.models.length > 0;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.content },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "result", schema: request.schema, strict: true },
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      return { kind: "unavailable", reason: `ağ hatası: ${String(error)}` };
    }

    if (!response.ok) {
      return {
        kind: "unavailable",
        reason: `${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`,
        retryAfterMs:
          response.status === 429
            ? retryAfterHeaderMs(response.headers.get("retry-after"))
            : undefined,
      };
    }

    const body = (await response.json()) as MistralResponse;
    const usage = {
      ...EMPTY_USAGE,
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
    const choice = body.choices?.[0];
    const finishReason = choice?.finish_reason ?? "";
    if (finishReason === "length" || finishReason === "model_length") {
      return { kind: "max_tokens", usage };
    }
    if (finishReason === "error") {
      return { kind: "unavailable", reason: "model hata ile bitti", usage };
    }

    const content = choice?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : (content ?? []).map((part) => part.text ?? "").join("");
    try {
      return { kind: "ok", data: parseJsonText(text), usage };
    } catch {
      return { kind: "unavailable", reason: "JSON olmayan çıktı", usage };
    }
  }
}
