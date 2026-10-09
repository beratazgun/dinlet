import { Module } from "@nestjs/common";

import { DateManager } from "#/core/utils/date-manager.js";
import { AuthModule } from "#/modules/auth/auth.module.js";
import { BillingModule } from "#/modules/billing/billing.module.js";
import { StudyControllers } from "#/modules/study/controllers/index.js";
import { StudyEventHandler } from "#/modules/study/event/study.event-handler.js";
import { StudyRepositories } from "#/modules/study/repository/index.js";
import { StudyServices } from "#/modules/study/services/index.js";

/**
 * Çalışma araçları: klasörler, etiketler, sınav hedefi ve aralıklı tekrar. Belge ve dinleme
 * tablolarını kendi repository'siyle okur; belge modülüne bağımlı değildir.
 */
@Module({
  imports: [AuthModule, BillingModule],
  controllers: [...StudyControllers],
  providers: [
    ...StudyRepositories,
    ...StudyServices,
    StudyEventHandler,
    DateManager,
  ],
  exports: [...StudyRepositories, ...StudyServices],
})
export class StudyModule {}
