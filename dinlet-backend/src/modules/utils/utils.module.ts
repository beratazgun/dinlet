import { Module } from "@nestjs/common";

import { UtilsController } from "#/modules/utils/utils.controller.js";
import { UtilsRepository } from "#/modules/utils/utils.repository.js";
import { UtilsService } from "#/modules/utils/utils.service.js";

@Module({
  controllers: [UtilsController],
  providers: [UtilsService, UtilsRepository],
  exports: [UtilsService, UtilsRepository],
})
export class UtilsModule {}
