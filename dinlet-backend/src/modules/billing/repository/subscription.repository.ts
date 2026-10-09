import { Injectable } from "@nestjs/common";

import type { SubscriptionSnapshot } from "#/modules/billing/utils/index.js";
import { DatabaseService } from "#database/database.service.js";
import type {
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionStore,
} from "#database/enums.js";

export interface SubscriptionWrite {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  rcAppUserId: string;
  productId: string | null;
  currentPeriodEnd: string | null;
  store: SubscriptionStore | null;
  lastEventAt: string;
}

/** Kullanıcı aboneliği (RevenueCat'ten senkronlanır). */
@Injectable()
export class SubscriptionRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  findSnapshotByUserId(userId: number): Promise<SubscriptionSnapshot | null> {
    return this.db.orm.public.Subscription.where({ userId })
      .select("plan", "status", "currentPeriodEnd")
      .first();
  }

  findByUserId(userId: number) {
    return this.db.orm.public.Subscription.where({ userId })
      .select(
        "plan",
        "status",
        "currentPeriodEnd",
        "store",
        "productId",
        "lastEventAt",
      )
      .first();
  }

  async upsertForUser(userId: number, input: SubscriptionWrite): Promise<void> {
    await this.db.orm.public.Subscription.upsert({
      create: { userId, ...input },
      update: input,
      conflictOn: { userId },
    });
  }

  async userExists(userId: number): Promise<boolean> {
    return (
      (await this.db.orm.public.User.where({ id: userId })
        .where((user) => user.deletedAt.isNull())
        .select("id")
        .first()) !== null
    );
  }
}
