import { describe, expect, it } from "vitest";

import {
  nonSubscriptionPurchases,
  PLAN_LIMITS,
  parseRevenueCatEvent,
  resolveEffectivePlan,
  resolveUserId,
  stateFromEvent,
  stateFromSubscriber,
  type RevenueCatWebhookEvent,
} from "#/modules/billing/utils/index.js";

const event = (overrides: Partial<RevenueCatWebhookEvent>): RevenueCatWebhookEvent => ({
  id: "evt-1",
  type: "INITIAL_PURCHASE",
  app_user_id: "42",
  event_timestamp_ms: 1_000,
  expiration_at_ms: 2_000,
  entitlement_ids: ["pro"],
  product_id: "dinlet_pro_monthly",
  store: "APP_STORE",
  ...overrides,
});

describe("RevenueCat eşlemesi", () => {
  it("geçersiz gövdeyi reddeder", () => {
    expect(parseRevenueCatEvent({})).toBeNull();
    expect(parseRevenueCatEvent({ event: { id: "x" } })).toBeNull();
    expect(parseRevenueCatEvent({ event: event({}) })).toMatchObject({ id: "evt-1" });
  });

  it("kullanıcıyı app_user_id, original veya alias'tan bulur", () => {
    expect(resolveUserId(event({}))).toBe(42);
    expect(
      resolveUserId(event({ app_user_id: "$RCAnonymousID:abc", aliases: ["$RCAnonymousID:abc", "7"] })),
    ).toBe(7);
    expect(resolveUserId(event({ app_user_id: "$RCAnonymousID:abc" }))).toBeNull();
  });

  it("olay türünü abonelik durumuna çevirir", () => {
    expect(stateFromEvent(event({}), "pro")).toMatchObject({
      plan: "PRO",
      status: "ACTIVE",
      currentPeriodEndMs: 2_000,
      store: "APP_STORE",
    });
    expect(stateFromEvent(event({ type: "CANCELLATION" }), "pro")?.status).toBe("CANCELLED");
    expect(stateFromEvent(event({ type: "BILLING_ISSUE" }), "pro")?.status).toBe("GRACE");
    expect(stateFromEvent(event({ type: "EXPIRATION" }), "pro")).toMatchObject({
      plan: "FREE",
      status: "EXPIRED",
    });
    expect(stateFromEvent(event({ type: "TEST" }), "pro")).toBeNull();
    // Başka bir entitlement Pro vermez.
    expect(stateFromEvent(event({ entitlement_ids: ["other"] }), "pro")).toBeNull();
  });

  it("tek seferlik satın alma yalnızca Pro entitlement'ı taşıyorsa Pro yapar", () => {
    // Mağaza içeriği: entitlement yok → abonelik değişmez.
    expect(
      stateFromEvent(
        event({ type: "NON_RENEWING_PURCHASE", entitlement_ids: null, product_id: "dinlet_store_x" }),
        "pro",
      ),
    ).toBeNull();
    // Ömür boyu Pro.
    expect(
      stateFromEvent(event({ type: "NON_RENEWING_PURCHASE", expiration_at_ms: null }), "pro"),
    ).toMatchObject({ plan: "PRO", status: "ACTIVE", currentPeriodEndMs: null });
  });

  it("REST kaydındaki tek seferlik satın almaları çıkarır", () => {
    expect(
      nonSubscriptionPurchases({
        subscriber: {
          non_subscriptions: {
            dinlet_store_a: [
              { id: "rc-1", store_transaction_id: "tx-1", store: "app_store" },
            ],
            dinlet_store_b: [{ id: "rc-2", store: "play_store" }],
            empty: [],
          },
        },
      }),
    ).toEqual([
      { productId: "dinlet_store_a", transactionId: "tx-1", store: "APP_STORE" },
      { productId: "dinlet_store_b", transactionId: "rc-2", store: "PLAY_STORE" },
    ]);
    expect(nonSubscriptionPurchases({})).toEqual([]);
  });

  it("REST abone kaydından güncel durumu türetir", () => {
    const now = Date.parse("2026-10-08T00:00:00Z");
    const subscriber = (expires: string, flags: Record<string, string> = {}) => ({
      subscriber: {
        entitlements: { pro: { expires_date: expires, product_identifier: "p" } },
        subscriptions: { p: { store: "play_store", ...flags } },
      },
    });

    expect(stateFromSubscriber(subscriber("2026-11-08T00:00:00Z"), "pro", now)).toMatchObject({
      plan: "PRO",
      status: "ACTIVE",
      store: "PLAY_STORE",
    });
    expect(
      stateFromSubscriber(
        subscriber("2026-11-08T00:00:00Z", { unsubscribe_detected_at: "2026-10-01" }),
        "pro",
        now,
      ).status,
    ).toBe("CANCELLED");
    expect(stateFromSubscriber(subscriber("2026-10-01T00:00:00Z"), "pro", now)).toMatchObject({
      plan: "FREE",
      status: "EXPIRED",
    });
    expect(stateFromSubscriber({ subscriber: {} }, "pro", now).plan).toBe("FREE");
  });

  it("etkin planı dönem sonu ve duruma göre belirler", () => {
    const now = new Date("2026-10-08T00:00:00Z");
    const pro = (status: "ACTIVE" | "GRACE" | "CANCELLED" | "EXPIRED", end: string | null) =>
      resolveEffectivePlan({ plan: "PRO", status, currentPeriodEnd: end }, now);

    expect(resolveEffectivePlan(null, now)).toBe("FREE");
    expect(pro("ACTIVE", "2026-11-01T00:00:00Z")).toBe("PRO");
    expect(pro("CANCELLED", "2026-11-01T00:00:00Z")).toBe("PRO");
    expect(pro("CANCELLED", "2026-10-01T00:00:00Z")).toBe("FREE");
    expect(pro("EXPIRED", null)).toBe("FREE");
    expect(PLAN_LIMITS.PRO.queuePriority).toBeLessThan(PLAN_LIMITS.FREE.queuePriority);
  });
});
