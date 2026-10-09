import Anthropic from "@anthropic-ai/sdk";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvType } from "#config/env.validation.js";
import { supportsServerFallback } from "#/infra/llm/llm-pricing.js";
import {
  parseJsonText,
  parseList,
  retryAfterHeaderMs,
  type LlmProvider,
  type ProviderRequest,
  type ProviderResult,
} from "#/infra/llm/providers/llm-provider.js";

/**
 * Anthropic Claude. Akış (stream) + `finalMessage()`; JSON çıktısı
 * `output_config.format` ile zorlanır, sistem prompt'u önbelleğe alınır.
 * Opus/Sonnet'te sunucu tarafı refusal fallback'i (`fallbacks: "default"`).
 */
@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  readonly models: string[];
  private readonly client: Anthropic | null;
  private readonly effort: EnvType["LLM_EFFORT"];

  constructor(configService: ConfigService<EnvType>) {
    const apiKey = configService.get("ANTHROPIC_API_KEY", { infer: true });
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.models = parseList(configService.get("ANTHROPIC_LLM_MODELS", { infer: true }));
    this.effort = configService.getOrThrow("LLM_EFFORT", { infer: true });
  }

  get isConfigured(): boolean {
    return this.client !== null && this.models.length > 0;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await this.client!.beta.messages
        .stream({
          model: request.model,
          max_tokens: request.maxTokens,
          system: [
            {
              type: "text",
              text: request.system,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: request.content }],
          output_config: {
            effort: this.effort,
            format: { type: "json_schema", schema: request.schema },
          },
          ...(supportsServerFallback(request.model)
            ? {
                betas: ["server-side-fallback-2026-07-01"],
                fallbacks: "default" as const,
              }
            : {}),
        })
        .finalMessage();
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return {
          kind: "unavailable",
          reason: `429 ${error.message}`,
          retryAfterMs: retryAfterHeaderMs(error.headers?.get("retry-after") ?? null),
        };
      }
      if (error instanceof Anthropic.APIError) {
        return { kind: "unavailable", reason: `${error.status} ${error.message}` };
      }
      return { kind: "unavailable", reason: `ağ hatası: ${String(error)}` };
    }

    const usage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    };
    if (message.stop_reason === "refusal") {
      return {
        kind: "refusal",
        reason: message.stop_details?.category ?? "refusal",
        usage,
      };
    }
    if (message.stop_reason === "max_tokens") return { kind: "max_tokens", usage };

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    try {
      return { kind: "ok", data: parseJsonText(text), usage };
    } catch {
      return { kind: "unavailable", reason: "JSON olmayan çıktı", usage };
    }
  }
}
