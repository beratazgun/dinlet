import { Injectable } from "@nestjs/common";

import { OkResponse } from "#/core/http/index.js";
import { SubscriptionRepository } from "#/modules/billing/repository/index.js";
import { UsageService } from "#/modules/billing/services/usage.service.js";

/** Kullanıcının planı, dönemi ve bu ayki kota kullanımı. */
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly usageService: UsageService,
  ) {}

  async getMine(userId: number): Promise<OkResponse> {
    const [subscription, limits] = await Promise.all([
      this.subscriptionRepository.findByUserId(userId),
      this.usageService.getPlanLimits(userId),
    ]);
    const usage = await this.usageService.getMonthlyUsage(userId, limits);

    return new OkResponse("Abonelik bilgisi", {
      plan: limits.plan,
      status: subscription?.status ?? null,
      store: subscription?.store ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      usage: { ...usage, monthlyPages: limits.monthlyPages },
      limits: {
        maxFileBytes: limits.maxFileBytes,
        maxPagesPerDocument: limits.maxPagesPerDocument,
        rewriteMode: limits.rewriteMode,
      },
    });
  }
}
