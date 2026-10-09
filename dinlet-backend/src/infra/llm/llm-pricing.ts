/** Milyon token başına USD (Anthropic birinci taraf API fiyatları). */
interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

interface ModelPricingTiers {
  base: ModelPricing;
  /**
   * İstem (girdi + önbellek token'ları) bu sınırı aşarsa isteğin tamamı
   * `long` fiyatından hesaplanır.
   */
  long?: { aboveInputTokens: number; pricing: ModelPricing };
}

/**
 * Bilinen modellerin fiyatları. Listede olmayan model için maliyet `0`
 * yazılır ve uyarı loglanır; gerçek maliyet `llm_usage` token'larından
 * yeniden hesaplanabilir.
 *
 * Haiku 5.5: 100K token'a kadar 0,10 / 0,50, üstü 0,50 / 2,50
 * (platform.claude.com/docs/en/about-claude/pricing). Bölümler ~2–3K token
 * olduğu için pratikte hep alt kademe uygulanır. Uzun kademenin önbellek
 * fiyatı listelenmediğinden aynı oranla (5×) ölçeklendi.
 */
const PRICING: Record<string, ModelPricingTiers> = {
  "claude-haiku-5-5": {
    base: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
    long: {
      aboveInputTokens: 100_000,
      pricing: { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 },
    },
  },
  "claude-sonnet-5-5": {
    base: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  },
  "claude-opus-5-5": {
    base: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Çağrının USD maliyeti; model bilinmiyorsa `null`. */
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const tiers = PRICING[model];
  if (!tiers) return null;

  const promptTokens =
    usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  const pricing =
    tiers.long && promptTokens > tiers.long.aboveInputTokens
      ? tiers.long.pricing
      : tiers.base;

  return (
    (usage.inputTokens * pricing.input +
      usage.outputTokens * pricing.output +
      usage.cacheReadTokens * pricing.cacheRead +
      usage.cacheWriteTokens * pricing.cacheWrite) /
    1_000_000
  );
}

/**
 * Sunucu tarafı refusal fallback'i (`fallbacks: "default"`) yalnızca Opus ve
 * Sonnet modellerinde var; Haiku'da gönderilmez.
 */
export function supportsServerFallback(model: string): boolean {
  return /^claude-(opus|sonnet|fable)-/.test(model);
}
