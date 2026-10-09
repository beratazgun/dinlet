import { enumType, member } from "@prisma/orm-postgres/contract-builder";
import {
  autoIncrementId,
  type ModelHelpers,
} from "#database/models/model.types.js";

const pgText = { codecId: "pg/text@1", nativeType: "text" } as const;

export const SubscriptionPlan = enumType(
  "SubscriptionPlan",
  pgText,
  member("FREE"),
  member("PRO"),
);

/** RevenueCat olaylarından türetilen abonelik durumu. */
export const SubscriptionStatus = enumType(
  "SubscriptionStatus",
  pgText,
  member("ACTIVE"),
  member("GRACE"),
  member("EXPIRED"),
  member("CANCELLED"),
);

export const SubscriptionStore = enumType(
  "SubscriptionStore",
  pgText,
  member("APP_STORE"),
  member("PLAY_STORE"),
);

export const billingEnums = {
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionStore,
};

export function createBillingModels({ field, model }: ModelHelpers) {
  const Subscription = model("Subscription", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().unique().column("user_id"),
      plan: field
        .namedType(SubscriptionPlan)
        .default(SubscriptionPlan.members.FREE),
      status: field
        .namedType(SubscriptionStatus)
        .default(SubscriptionStatus.members.ACTIVE),
      rcAppUserId: field.text().column("rc_app_user_id"),
      productId: field.text().optional().column("product_id"),
      currentPeriodEnd: field.temporal
        .timestamptzString()
        .optional()
        .column("current_period_end"),
      store: field.namedType(SubscriptionStore).optional(),
      /** İşlenen son RevenueCat olayının zamanı; daha eski olaylar yok sayılır. */
      lastEventAt: field.temporal
        .timestamptzString()
        .optional()
        .column("last_event_at"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(() => ({ table: "subscriptions" }));

  /**
   * Sayfa kotası defteri. Pozitif `pages` düşüm, negatif iadedir; aylık
   * kullanım `periodKey` (Europe/Istanbul, `2026-10`) ile toplanır.
   */
  const UsageLedger = model("UsageLedger", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      documentId: field.int().optional().column("document_id"),
      pages: field.int(),
      periodKey: field.text().column("period_key"),
      createdAt: field.temporal.createdAtString().column("created_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "usage_ledger",
    indexes: [
      constraints.index([cols.userId, cols.periodKey]),
      constraints.index([cols.documentId]),
    ],
  }));

  /** Her LLM çağrısının token kullanımı ve hesaplanmış maliyeti. */
  const LlmUsage = model("LlmUsage", {
    fields: {
      id: autoIncrementId(field),
      documentId: field.int().optional().column("document_id"),
      sectionId: field.int().optional().column("section_id"),
      model: field.text(),
      inputTokens: field.int().column("input_tokens"),
      outputTokens: field.int().column("output_tokens"),
      cacheReadTokens: field.int().default(0).column("cache_read_tokens"),
      cacheWriteTokens: field.int().default(0).column("cache_write_tokens"),
      costUsd: field.decimal().column("cost_usd"),
      createdAt: field.temporal.createdAtString().column("created_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "llm_usage",
    indexes: [
      constraints.index([cols.documentId]),
      constraints.index([cols.createdAt]),
    ],
  }));

  /** İşlenmiş RevenueCat webhook olayları; aynı olay ikinci kez işlenmez. */
  const RevenueCatEvent = model("RevenueCatEvent", {
    fields: {
      id: autoIncrementId(field),
      eventId: field.text().unique().column("event_id"),
      type: field.text(),
      appUserId: field.text().column("app_user_id"),
      payload: field.json(),
      createdAt: field.temporal.createdAtString().column("created_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "revenuecat_events",
    indexes: [constraints.index([cols.appUserId])],
  }));

  return { Subscription, UsageLedger, LlmUsage, RevenueCatEvent };
}
