import { Injectable } from "@nestjs/common";

import { DateManager } from "#/core/utils/date-manager.js";
import { DatabaseService } from "#database/database.service.js";
import type {
  StoreEntitlementSource,
  SubscriptionStore,
} from "#database/enums.js";

export interface EntitlementGrant {
  source: StoreEntitlementSource;
  bundleId?: number | null;
  productId?: string | null;
  transactionId?: string | null;
  store?: SubscriptionStore | null;
}

/** Kullanıcıların mağaza içeriklerine sahipliği. */
@Injectable()
export class StoreEntitlementRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly dateManager: DateManager,
  ) {}

  private get db() {
    return this.database.client;
  }

  /** Kullanıcının verilen içeriklerden geçerli sahipliği olanlar. */
  async findOwnedIds(userId: number, itemIds?: number[]): Promise<Set<number>> {
    if (itemIds?.length === 0) return new Set();
    let query = this.db.orm.public.StoreEntitlement.where({ userId }).where(
      (entitlement) => entitlement.revokedAt.isNull(),
    );
    if (itemIds) {
      query = query.where((entitlement) => entitlement.storeItemId.in(itemIds));
    }
    const rows = await query.select("storeItemId").all();
    return new Set(rows.map((row) => row.storeItemId));
  }

  async userExists(userId: number): Promise<boolean> {
    const user = await this.db.orm.public.User.where({ id: userId })
      .where((row) => row.deletedAt.isNull())
      .select("id")
      .first();
    return user !== null;
  }

  async isOwned(userId: number, itemId: number): Promise<boolean> {
    return (await this.findOwnedIds(userId, [itemId])).has(itemId);
  }

  /**
   * Sahipliği yazar; iade edilmiş eski kayıt varsa yeniden geçerli olur.
   * Yeni verilen (önceden geçerli sahipliği olmayan) içerik ID'leri döner.
   */
  async grant(
    userId: number,
    itemIds: number[],
    grant: EntitlementGrant,
  ): Promise<number[]> {
    if (itemIds.length === 0) return [];
    const owned = await this.findOwnedIds(userId, itemIds);
    const fresh = itemIds.filter((itemId) => !owned.has(itemId));
    await this.db.transaction(async (tx) => {
      for (const storeItemId of fresh) {
        const values = {
          source: grant.source,
          bundleId: grant.bundleId ?? null,
          productId: grant.productId ?? null,
          transactionId: grant.transactionId ?? null,
          store: grant.store ?? null,
          revokedAt: null,
        };
        await tx.orm.public.StoreEntitlement.upsert({
          create: { userId, storeItemId, ...values },
          update: values,
          conflictOn: { userId, storeItemId },
        });
      }
    });
    return fresh;
  }

  /**
   * İade edilen ürünün sahipliklerini geri alır. Tek seferlik ürün aynı
   * hesapta bir kez alınabildiği için ürün kimliği yeterlidir (işlem kimliği
   * mağazalar arasında farklı biçimde gelebilir). Geri alınan içerik ID'leri döner.
   */
  async revoke(userId: number, productId: string): Promise<number[]> {
    const rows = await this.db.orm.public.StoreEntitlement.where({
      userId,
      productId,
    })
      .where((entitlement) => entitlement.revokedAt.isNull())
      .select("id", "storeItemId")
      .all();
    if (rows.length === 0) return [];
    await this.db.orm.public.StoreEntitlement.where((entitlement) =>
      entitlement.id.in(rows.map((row) => row.id)),
    ).updateAndCount({ revokedAt: this.dateManager.toISOString() });
    return rows.map((row) => row.storeItemId);
  }
}
