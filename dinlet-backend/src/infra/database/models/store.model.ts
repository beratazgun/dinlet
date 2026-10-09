import { enumType, member } from "@prisma/orm-postgres/contract-builder";
import {
  autoIncrementId,
  type ModelHelpers,
} from "#database/models/model.types.js";
import { SubscriptionStore } from "#database/models/billing.model.js";

const pgText = { codecId: "pg/text@1", nativeType: "text" } as const;

/** Mağaza içeriğinin kaynağı ve lisansı (listede rozet olarak görünür). */
export const StoreSource = enumType(
  "StoreSource",
  pgText,
  member("ORIGINAL"),
  member("LEGISLATION"),
  member("PUBLISHER"),
  member("PUBLIC_DOMAIN"),
  /** Bir kullanıcının paylaştığı, editörün onayladığı not (her zaman ücretsiz). */
  member("COMMUNITY"),
);

/** Kullanıcının içeriğe nasıl sahip olduğu. */
export const StoreEntitlementSource = enumType(
  "StoreEntitlementSource",
  pgText,
  member("FREE"),
  member("PURCHASE"),
  member("GRANT"),
);

/** Kullanıcının "Mağazada paylaş" başvurusu. */
export const SubmissionStatus = enumType(
  "SubmissionStatus",
  pgText,
  member("PENDING"),
  member("APPROVED"),
  member("REJECTED"),
  member("WITHDRAWN"),
);

export const storeEnums = {
  StoreSource,
  StoreEntitlementSource,
  SubmissionStatus,
};

/**
 * Not mağazası. İçerik, editör hesabındaki hazır bir nottan (`documentId`)
 * yayınlanır; kullanıcı kütüphanesine eklediğinde o notun bir kopyası
 * açılır (`documents.store_item_id`). Kopya ses dosyalarını kaynakla
 * paylaşır, sayfa kotasından düşmez.
 */
export function createStoreModels({ field, model }: ModelHelpers) {
  /** İki seviyeli katalog: sınav (KPSS) → ders (Tarih). */
  const StoreCategory = model("StoreCategory", {
    fields: {
      id: autoIncrementId(field),
      parentId: field.int().optional().column("parent_id"),
      slug: field.text().unique(),
      name: field.text(),
      position: field.int().default(0),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "store_categories",
    indexes: [constraints.index([cols.parentId, cols.position])],
  }));

  const StoreItem = model("StoreItem", {
    fields: {
      id: autoIncrementId(field),
      slug: field.text().unique(),
      title: field.text(),
      description: field.text(),
      source: field.namedType(StoreSource),
      /** Ortak yayınevi içeriğinde yayınevinin adı. */
      publisherName: field.text().optional().column("publisher_name"),
      /** "Dinlet editörleri" gibi hazırlayan bilgisi; topluluk notunda yazarın adı. */
      credit: field.text().optional(),
      /** Topluluk notunu paylaşan kullanıcı. */
      authorUserId: field.int().optional().column("author_user_id"),
      /** Kaynak not (editör hesabında, hazır). */
      documentId: field.int().unique().column("document_id"),
      /** App Store / Play Store ürün kimliği; `null` ise ücretsiz. */
      productId: field.text().optional().unique().column("product_id"),
      /** Listede gösterilen fiyat (TL); asıl fiyat mağazadan gelir. */
      priceTry: field.decimal().optional().column("price_try"),
      /** Sahip olmayanın dinleyebileceği ilk bölüm sayısı ("Örnek dinle"). */
      sampleSections: field.int().default(1).column("sample_sections"),
      isFeatured: field.boolean().default(false).column("is_featured"),
      isPublished: field.boolean().default(false).column("is_published"),
      position: field.int().default(0),
      publishedAt: field.temporal
        .timestamptzString()
        .optional()
        .column("published_at"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "store_items",
    indexes: [constraints.index([cols.isPublished, cols.position])],
  }));

  /** Bir içerik birden çok sınava girebilir (Anayasa: KPSS, ALES, Hukuk). */
  const StoreItemCategory = model("StoreItemCategory", {
    fields: {
      id: autoIncrementId(field),
      storeItemId: field.int().column("store_item_id"),
      categoryId: field.int().column("category_id"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.storeItemId, fields.categoryId])],
    }))
    .sql(({ cols, constraints }) => ({
      table: "store_item_categories",
      indexes: [constraints.index([cols.categoryId])],
    }));

  /** Paket ("KPSS Tarih, tamamı"): tek satın almayla birden çok içerik. */
  const StoreBundle = model("StoreBundle", {
    fields: {
      id: autoIncrementId(field),
      slug: field.text().unique(),
      title: field.text(),
      description: field.text(),
      /** Paketin gösterildiği ders/sınav. */
      categoryId: field.int().optional().column("category_id"),
      productId: field.text().unique().column("product_id"),
      priceTry: field.decimal().optional().column("price_try"),
      isPublished: field.boolean().default(false).column("is_published"),
      position: field.int().default(0),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "store_bundles",
    indexes: [constraints.index([cols.categoryId, cols.position])],
  }));

  const StoreBundleItem = model("StoreBundleItem", {
    fields: {
      id: autoIncrementId(field),
      bundleId: field.int().column("bundle_id"),
      storeItemId: field.int().column("store_item_id"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.bundleId, fields.storeItemId])],
    }))
    .sql(({ cols, constraints }) => ({
      table: "store_bundle_items",
      indexes: [constraints.index([cols.storeItemId])],
    }));

  /**
   * Kullanıcının içeriğe sahipliği. Kütüphaneden silinen içerik yeniden
   * eklenebilir; iade edilen satın almada `revokedAt` dolar.
   */
  const StoreEntitlement = model("StoreEntitlement", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      storeItemId: field.int().column("store_item_id"),
      source: field.namedType(StoreEntitlementSource),
      /** Paketle alındıysa paket. */
      bundleId: field.int().optional().column("bundle_id"),
      productId: field.text().optional().column("product_id"),
      transactionId: field.text().optional().column("transaction_id"),
      store: field.namedType(SubscriptionStore).optional(),
      revokedAt: field.temporal
        .timestamptzString()
        .optional()
        .column("revoked_at"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.userId, fields.storeItemId])],
    }))
    .sql(({ cols, constraints }) => ({
      table: "store_entitlements",
      indexes: [
        constraints.index([cols.storeItemId]),
        constraints.index([cols.userId, cols.productId]),
      ],
    }));

  /**
   * "Mağazada paylaş": kullanıcı kendi hazır notunu önerir, editör onaylarsa
   * notun o anki hâlinin kopyası (`StoreItem.documentId`, sesleri ayrı
   * kopyalanmış) mağazaya ücretsiz girer. Kullanıcı sonra kendi notunu
   * değiştirebilir veya silebilir; mağazadaki sürüm etkilenmez.
   */
  const StoreSubmission = model("StoreSubmission", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      /** Kullanıcının paylaştığı not (silinirse başvuru kalır). */
      documentId: field.int().optional().column("document_id"),
      title: field.text(),
      description: field.text(),
      /** Önerilen sınav/ders kategorileri. */
      categoryIds: field.json().column("category_ids"),
      status: field
        .namedType(SubmissionStatus)
        .default(SubmissionStatus.members.PENDING),
      /** İçeriğin kendisine ait olduğunu ve herkese açılmasına rızasını onayladığı an. */
      rightsConfirmedAt: field.temporal
        .timestamptzString()
        .column("rights_confirmed_at"),
      rejectionReason: field.text().optional().column("rejection_reason"),
      reviewedBy: field.int().optional().column("reviewed_by"),
      reviewedAt: field.temporal
        .timestamptzString()
        .optional()
        .column("reviewed_at"),
      storeItemId: field.int().optional().column("store_item_id"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "store_submissions",
    indexes: [
      constraints.index([cols.userId, cols.createdAt]),
      constraints.index([cols.status, cols.createdAt]),
      constraints.index([cols.documentId]),
    ],
  }));

  return {
    StoreSubmission,
    StoreCategory,
    StoreItem,
    StoreItemCategory,
    StoreBundle,
    StoreBundleItem,
    StoreEntitlement,
  };
}
