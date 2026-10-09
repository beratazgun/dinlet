import { Module } from "@nestjs/common";

import { DateManager } from "#/core/utils/date-manager.js";
import { Paginator } from "#/core/utils/paginator.js";
import { BillingModule } from "#/modules/billing/billing.module.js";
import { DocumentModule } from "#/modules/document/document.module.js";
import { StoreControllers } from "#/modules/store/controllers/index.js";
import { StoreEventHandler } from "#/modules/store/event/store.event-handler.js";
import { StoreRepositories } from "#/modules/store/repository/index.js";
import { StoreServices } from "#/modules/store/services/index.js";

/**
 * Not mağazası: hazır, lisanslı sesli anlatımlar. İçerik kullanıcının
 * kütüphanesine kopya not olarak eklenir; satın alma RevenueCat'le.
 */
@Module({
  imports: [BillingModule, DocumentModule],
  controllers: [...StoreControllers],
  providers: [
    ...StoreRepositories,
    ...StoreServices,
    StoreEventHandler,
    DateManager,
    Paginator,
  ],
  exports: [...StoreRepositories, ...StoreServices],
})
export class StoreModule {}
