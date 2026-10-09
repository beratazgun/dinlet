import { Module } from "@nestjs/common";
import { HealthController } from "#/infra/health/health.controller.js";
import { HealthService } from "#/infra/health/health.service.js";

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
