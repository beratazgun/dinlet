import { Module } from "@nestjs/common";

import { DateManager } from "#/core/utils/date-manager.js";
import { BillingControllers } from "#/modules/billing/controllers/index.js";
import { BillingRepositories } from "#/modules/billing/repository/index.js";
import { BillingServices } from "#/modules/billing/services/index.js";

/**
 * Plan, abonelik (RevenueCat) ve aylık sayfa kotası (doküman §10).
 */
@Module({
  controllers: [...BillingControllers],
  providers: [...BillingRepositories, ...BillingServices, DateManager],
  exports: [...BillingRepositories, ...BillingServices],
})
export class BillingModule {}
