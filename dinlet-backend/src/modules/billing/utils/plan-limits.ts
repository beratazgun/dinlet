import {
  RewriteMode,
  SubscriptionPlan,
  SubscriptionStatus,
  type RewriteMode as RewriteModeValue,
  type SubscriptionPlan as SubscriptionPlanValue,
  type SubscriptionStatus as SubscriptionStatusValue,
} from "#database/enums.js";

const MB = 1_024 * 1_024;

export interface PlanLimits {
  plan: SubscriptionPlanValue;
  /** Aylık işlenebilecek toplam sayfa. */
  monthlyPages: number;
  /** Tek PDF için en büyük dosya boyutu (bayt). */
  maxFileBytes: number;
  /** Tek PDF için en fazla sayfa. */
  maxPagesPerDocument: number;
  /** BullMQ önceliği: küçük sayı önce işlenir. */
  queuePriority: number;
  /** Free: kural tabanlı okuma; Pro: LLM ile akıcı anlatım. */
  rewriteMode: RewriteModeValue;
}

/**
 * Plan limitleri (doküman §10 — değerler açık karar; tek yerden değişir).
 */
export const PLAN_LIMITS: Record<SubscriptionPlanValue, PlanLimits> = {
  [SubscriptionPlan.FREE]: {
    plan: SubscriptionPlan.FREE,
    monthlyPages: 30,
    maxFileBytes: 10 * MB,
    maxPagesPerDocument: 150,
    queuePriority: 10,
    rewriteMode: RewriteMode.RAW,
  },
  [SubscriptionPlan.PRO]: {
    plan: SubscriptionPlan.PRO,
    monthlyPages: 500,
    maxFileBytes: 30 * MB,
    maxPagesPerDocument: 150,
    queuePriority: 1,
    rewriteMode: RewriteMode.FLUENT,
  },
};

/** Pro hakları süren abonelik durumları (ödeme sorunu yaşanan `GRACE` dahil). */
const ENTITLED_STATUSES: SubscriptionStatusValue[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.GRACE,
  // İptal edilmiş abonelik dönem sonuna kadar Pro kalır.
  SubscriptionStatus.CANCELLED,
];

export interface SubscriptionSnapshot {
  plan: SubscriptionPlanValue;
  status: SubscriptionStatusValue;
  /** ISO 8601; `null` ise süresiz. */
  currentPeriodEnd: string | null;
}

/** Aboneliğe göre kullanıcının şu anki etkin planı (yoksa Free). */
export function resolveEffectivePlan(
  subscription: SubscriptionSnapshot | null,
  now: Date,
): SubscriptionPlanValue {
  if (!subscription || subscription.plan === SubscriptionPlan.FREE) {
    return SubscriptionPlan.FREE;
  }
  if (!ENTITLED_STATUSES.includes(subscription.status)) {
    return SubscriptionPlan.FREE;
  }
  if (
    subscription.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd).getTime() <= now.getTime()
  ) {
    return SubscriptionPlan.FREE;
  }
  return subscription.plan;
}

/** Akıcı anlatım ve LLM'li çalışma araçlarının kilit nedeni. */
export type FluentBlockReason = "PLAN" | "CONSENT";

/**
 * Akıcı anlatım (ve aynı kuralla soru, hızlı tekrar, hafıza kancası) neden
 * kullanılamıyor? Plan LLM'siz okumaysa `PLAN`; Pro'da LLM notu yurt
 * dışındaki servise gönderdiği için açık rıza yoksa `CONSENT` (KVKK).
 */
export function fluentBlockReason(
  limits: Pick<PlanLimits, "rewriteMode">,
  hasCrossBorderConsent: boolean,
): FluentBlockReason | null {
  if (limits.rewriteMode !== RewriteMode.FLUENT) return "PLAN";
  return hasCrossBorderConsent ? null : "CONSENT";
}
