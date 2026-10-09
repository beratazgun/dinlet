import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvType } from "#config/env.validation.js";
import { estimateCostUsd, type TokenUsage } from "#/infra/llm/llm-pricing.js";
import { AnthropicProvider } from "#/infra/llm/providers/anthropic.provider.js";
import { GeminiProvider } from "#/infra/llm/providers/gemini.provider.js";
import {
  parseList,
  type LlmProvider,
  type LlmProviderName,
  type StructuredRequest,
} from "#/infra/llm/providers/llm-provider.js";
import { MistralProvider } from "#/infra/llm/providers/mistral.provider.js";

export type { StructuredRequest } from "#/infra/llm/providers/llm-provider.js";

export interface LlmCallUsage extends TokenUsage {
  /** `sağlayıcı:model`, ör. `gemini:gemini-2.5-flash`. */
  model: string;
  costUsd: number;
}

/**
 * Zincirin sonucu. `usages`, ücretlendirilmiş tüm denemeleri içerir
 * (ör. bir sağlayıcı reddettiyse onun maliyeti de kaydedilir).
 */
export type StructuredResult =
  | { kind: "ok"; data: unknown; model: string; usages: LlmCallUsage[] }
  /** Yanıt token tavanında kesildi; girdi bölünüp yeniden denenmeli. */
  | { kind: "max_tokens"; model: string; usages: LlmCallUsage[] }
  /** Denenen her sağlayıcı güvenlik gerekçesiyle reddetti. */
  | { kind: "refusal"; usages: LlmCallUsage[] };

const DEFAULT_CHAIN: LlmProviderName[] = ["gemini", "mistral", "anthropic"];

/**
 * Sağlayıcı zinciri (fallback): `LLM_PROVIDER_CHAIN` sırasıyla, her
 * sağlayıcının modelleri sırayla denenir.
 *
 * - Kota/limit (429), sağlayıcı hatası, ağ veya bozuk çıktı → sıradaki model.
 *   429'da model, bildirilen süre (yoksa `LLM_QUOTA_COOLDOWN_SECONDS`)
 *   dinlendirilir; sonraki çağrılar onu atlar.
 * - Güvenlik reddi → sıradaki sağlayıcı (politikalar farklı).
 * - Anahtarı tanımlı olmayan sağlayıcı zincirden düşer.
 * - Hiçbiri yanıt veremezse hata fırlatılır; çağıran LLM'siz yola düşer.
 *
 * Dinlendirme bilgisi süreç belleğindedir; tek API instance'ı için yeterli.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly chain: LlmProvider[];
  private readonly maxTokens: number;
  private readonly defaultCooldownMs: number;
  /** `sağlayıcı:model` → bu ana kadar denenmez (epoch ms). */
  private readonly coolingUntil = new Map<string, number>();

  constructor(
    configService: ConfigService<EnvType>,
    gemini: GeminiProvider,
    mistral: MistralProvider,
    anthropic: AnthropicProvider,
  ) {
    const providers: Record<LlmProviderName, LlmProvider> = {
      gemini,
      mistral,
      anthropic,
    };
    const order = parseList(
      configService.get("LLM_PROVIDER_CHAIN", { infer: true }),
    ).filter((name): name is LlmProviderName => name in providers);

    this.chain = (order.length > 0 ? order : DEFAULT_CHAIN)
      .map((name) => providers[name])
      .filter((provider) => provider.isConfigured);
    this.maxTokens = configService.getOrThrow("LLM_MAX_TOKENS", { infer: true });
    this.defaultCooldownMs =
      configService.getOrThrow("LLM_QUOTA_COOLDOWN_SECONDS", { infer: true }) *
      1_000;

    this.logger.log(
      this.chain.length > 0
        ? `LLM zinciri: ${this.chain.map((p) => `${p.name}(${p.models.join(", ")})`).join(" → ")}`
        : "LLM zinciri boş (anahtar yok); Pro notlar LLM'siz işlenir",
    );
  }

  /** En az bir sağlayıcı yapılandırılmış mı? Değilse çağıranlar LLM'siz yola düşer. */
  get isEnabled(): boolean {
    return this.chain.length > 0;
  }

  async generateStructured(request: StructuredRequest): Promise<StructuredResult> {
    const usages: LlmCallUsage[] = [];
    const failures: string[] = [];
    let refused = false;

    for (const provider of this.chain) {
      for (const model of provider.models) {
        const key = `${provider.name}:${model}`;
        if ((this.coolingUntil.get(key) ?? 0) > Date.now()) {
          failures.push(`${key}: dinleniyor`);
          continue;
        }

        const result = await provider.generate({
          ...request,
          model,
          maxTokens: this.maxTokens,
        });
        if (result.kind !== "unavailable" || result.usage) {
          usages.push(this.toCallUsage(key, model, result.usage!));
        }

        if (result.kind === "ok") return { kind: "ok", data: result.data, model: key, usages };
        if (result.kind === "max_tokens") return { kind: "max_tokens", model: key, usages };
        if (result.kind === "refusal") {
          refused = true;
          failures.push(`${key}: ret (${result.reason})`);
          break; // Aynı sağlayıcının diğer modelleri de büyük olasılıkla reddeder.
        }

        failures.push(`${key}: ${result.reason}`);
        if (result.retryAfterMs !== undefined || /^429\b/.test(result.reason)) {
          const cooldown = result.retryAfterMs ?? this.defaultCooldownMs;
          this.coolingUntil.set(key, Date.now() + cooldown);
          this.logger.warn(`${key} kotası doldu; ${Math.round(cooldown / 1_000)} sn dinlenecek`);
        }
      }
    }

    if (refused) return { kind: "refusal", usages };
    throw new Error(`Hiçbir LLM sağlayıcısı yanıt veremedi: ${failures.join("; ")}`);
  }

  private toCallUsage(key: string, model: string, usage: TokenUsage): LlmCallUsage {
    // Fiyatı tanımlı olmayan modeller (ör. ücretsiz katman) 0 yazılır;
    // token'lar kayıtlı olduğu için maliyet sonradan hesaplanabilir.
    return { model: key, ...usage, costUsd: estimateCostUsd(model, usage) ?? 0 };
  }
}
