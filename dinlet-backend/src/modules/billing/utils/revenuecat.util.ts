import {
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionStore,
  type SubscriptionPlan as SubscriptionPlanValue,
  type SubscriptionStatus as SubscriptionStatusValue,
  type SubscriptionStore as SubscriptionStoreValue,
} from "#database/enums.js";

/** RevenueCat webhook olayının kullandığımız alanları. */
export interface RevenueCatWebhookEvent {
  id: string;
  type: string;
  app_user_id: string;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  product_id?: string | null;
  transaction_id?: string | null;
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms: number;
  store?: string | null;
}

/** Aboneliğin bizim modelimizdeki karşılığı. */
export interface SubscriptionState {
  plan: SubscriptionPlanValue;
  status: SubscriptionStatusValue;
  productId: string | null;
  /** Epoch ms; ömür boyu erişimde `null`. */
  currentPeriodEndMs: number | null;
  store: SubscriptionStoreValue | null;
}

/** Durumu değiştiren olaylar; diğerleri (TEST, TRANSFER…) yalnızca kaydedilir. */
const ACTIVATING = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
]);

/** Gövdeyi doğrular; beklenen biçimde değilse `null`. */
export function parseRevenueCatEvent(body: unknown): RevenueCatWebhookEvent | null {
  if (typeof body !== "object" || body === null) return null;
  const event = (body as { event?: unknown }).event;
  if (typeof event !== "object" || event === null) return null;
  const candidate = event as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.type !== "string" ||
    typeof candidate.app_user_id !== "string" ||
    typeof candidate.event_timestamp_ms !== "number"
  ) {
    return null;
  }
  return candidate as unknown as RevenueCatWebhookEvent;
}

/**
 * Mobil uygulama RevenueCat'i `appUserID = users.id` ile başlatır. Anonim
 * kimlikle (`$RCAnonymousID:…`) başlayan satın almada asıl kimlik
 * `aliases` / `original_app_user_id` içindedir.
 */
export function resolveUserId(event: RevenueCatWebhookEvent): number | null {
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
  ];
  for (const candidate of candidates) {
    if (candidate && /^\d+$/.test(candidate)) return Number(candidate);
  }
  return null;
}

export function mapStore(store: string | null | undefined): SubscriptionStoreValue | null {
  switch (store?.toUpperCase()) {
    case "APP_STORE":
    case "MAC_APP_STORE":
      return SubscriptionStore.APP_STORE;
    case "PLAY_STORE":
      return SubscriptionStore.PLAY_STORE;
    default:
      return null;
  }
}

/**
 * Olaydan abonelik durumu (REST API anahtarı yoksa kullanılır). Durumu
 * değiştirmeyen olay için `null`.
 */
export function stateFromEvent(
  event: RevenueCatWebhookEvent,
  proEntitlement: string,
): SubscriptionState | null {
  const base = {
    productId: event.product_id ?? null,
    currentPeriodEndMs: event.expiration_at_ms ?? null,
    store: mapStore(event.store),
  };
  // Tek seferlik satın alma (ör. mağaza içeriği) yalnızca açıkça Pro
  // entitlement'ı taşıyorsa (ömür boyu Pro) aboneliği etkiler.
  const grantsPro =
    event.type === "NON_RENEWING_PURCHASE"
      ? Boolean(event.entitlement_ids?.includes(proEntitlement))
      : !event.entitlement_ids || event.entitlement_ids.includes(proEntitlement);

  if (ACTIVATING.has(event.type)) {
    return grantsPro
      ? { ...base, plan: SubscriptionPlan.PRO, status: SubscriptionStatus.ACTIVE }
      : null;
  }
  switch (event.type) {
    case "CANCELLATION":
      // İptal edilen abonelik dönem sonuna kadar Pro kalır.
      return { ...base, plan: SubscriptionPlan.PRO, status: SubscriptionStatus.CANCELLED };
    case "BILLING_ISSUE":
      return { ...base, plan: SubscriptionPlan.PRO, status: SubscriptionStatus.GRACE };
    case "EXPIRATION":
      return { ...base, plan: SubscriptionPlan.FREE, status: SubscriptionStatus.EXPIRED };
    default:
      return null;
  }
}

interface SubscriberResponse {
  subscriber?: {
    entitlements?: Record<
      string,
      { expires_date?: string | null; product_identifier?: string }
    >;
    subscriptions?: Record<
      string,
      {
        store?: string;
        unsubscribe_detected_at?: string | null;
        billing_issues_detected_at?: string | null;
      }
    >;
  };
}

/**
 * RevenueCat REST API'deki abone kaydından güncel durum (doğruluk kaynağı;
 * webhook olaylarının sırasından bağımsız).
 */
export function stateFromSubscriber(
  response: SubscriberResponse,
  proEntitlement: string,
  nowMs: number,
): SubscriptionState {
  const entitlement = response.subscriber?.entitlements?.[proEntitlement];
  if (!entitlement) {
    return {
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.EXPIRED,
      productId: null,
      currentPeriodEndMs: null,
      store: null,
    };
  }

  const productId = entitlement.product_identifier ?? null;
  const subscription = productId
    ? response.subscriber?.subscriptions?.[productId]
    : undefined;
  const expiresMs = entitlement.expires_date
    ? Date.parse(entitlement.expires_date)
    : null;

  let status: SubscriptionStatusValue = SubscriptionStatus.ACTIVE;
  if (expiresMs !== null && expiresMs <= nowMs) status = SubscriptionStatus.EXPIRED;
  else if (subscription?.billing_issues_detected_at) status = SubscriptionStatus.GRACE;
  else if (subscription?.unsubscribe_detected_at) status = SubscriptionStatus.CANCELLED;

  return {
    plan:
      status === SubscriptionStatus.EXPIRED
        ? SubscriptionPlan.FREE
        : SubscriptionPlan.PRO,
    status,
    productId,
    currentPeriodEndMs: expiresMs,
    store: mapStore(subscription?.store),
  };
}

/** Abonelik dışı (tek seferlik) satın alma. */
export interface NonSubscriptionPurchase {
  productId: string;
  transactionId: string | null;
  store: SubscriptionStoreValue | null;
}

interface NonSubscriptionResponse {
  subscriber?: {
    non_subscriptions?: Record<
      string,
      { id?: string; store_transaction_id?: string; store?: string }[]
    >;
  };
}

/**
 * REST abone kaydındaki tek seferlik satın almalar (mağaza içerikleri).
 * İade edilen satın alma bu listede yer almaz.
 */
export function nonSubscriptionPurchases(
  response: NonSubscriptionResponse,
): NonSubscriptionPurchase[] {
  const purchases: NonSubscriptionPurchase[] = [];
  for (const [productId, transactions] of Object.entries(
    response.subscriber?.non_subscriptions ?? {},
  )) {
    const latest = transactions.at(-1);
    if (!latest) continue;
    purchases.push({
      productId,
      transactionId: latest.store_transaction_id ?? latest.id ?? null,
      store: mapStore(latest.store),
    });
  }
  return purchases;
}
