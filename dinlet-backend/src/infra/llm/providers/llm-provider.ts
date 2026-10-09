import type { TokenUsage } from "#/infra/llm/llm-pricing.js";

export type LlmProviderName = "gemini" | "mistral" | "anthropic";

export interface StructuredRequest {
  /** Sabit sistem prompt'u (değişken içerik koymayın; önbelleğe alınabilir). */
  system: string;
  /** Kullanıcı mesajı (değişken içerik her zaman sonda). */
  content: string;
  /** Yanıtın uyması gereken JSON şeması (standart JSON Schema). */
  schema: Record<string, unknown>;
}

export interface ProviderRequest extends StructuredRequest {
  model: string;
  maxTokens: number;
}

/**
 * Tek sağlayıcı + tek model denemesinin sonucu.
 *
 * - `unavailable`: kota (429), sağlayıcı hatası, ağ, geçersiz anahtar/model
 *   veya şemaya uymayan çıktı. Zincir bir sonraki modele geçer.
 * - `refusal`: güvenlik gerekçesiyle reddedildi. Zincir bir sonraki
 *   sağlayıcıya geçer (politikalar sağlayıcıya göre değişir).
 * - `max_tokens`: çıktı kesildi; çağıran girdiyi bölüp yeniden dener.
 */
export type ProviderResult =
  | { kind: "ok"; data: unknown; usage: TokenUsage }
  | { kind: "max_tokens"; usage: TokenUsage }
  | { kind: "refusal"; reason: string; usage: TokenUsage }
  | {
      kind: "unavailable";
      reason: string;
      /** Kota/limit hatasında modelin ne kadar dinlendirileceği. */
      retryAfterMs?: number;
      /** Ücretlendirilmiş ama kullanılamayan çıktı (ör. bozuk JSON). */
      usage?: TokenUsage;
    };

export interface LlmProvider {
  readonly name: LlmProviderName;
  /** API anahtarı tanımlı mı? Değilse zincirden düşer. */
  readonly isConfigured: boolean;
  /** Sağlayıcı içinde denenecek modeller, sırayla. */
  readonly models: string[];
  generate(request: ProviderRequest): Promise<ProviderResult>;
}

export const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

/** Virgülle ayrılmış env değeri → boş olmayan, kırpılmış liste. */
export function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Yanıt metnini JSON'a çevirir; olası ```json çitlerini temizler. */
export function parseJsonText(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

/** `Retry-After` başlığı (saniye) → ms. */
export function retryAfterHeaderMs(value: string | null): number | undefined {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : undefined;
}
