import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuditOptions, Public } from "#/core/decorators/index.js";
import { OkResponse } from "#/core/http/index.js";
import { HealthService } from "#/infra/health/health.service.js";

@ApiTags("Health")
@Public()
// Orkestratör probları saniyede birkaç kez gelir; denetim gürültüsü olmasın.
@AuditOptions({ enabled: false })
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Liveness - Sistem ayaktamı" })
  live(): OkResponse {
    return new OkResponse("ok", { status: "up" });
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness — DB ve Redis erişilebilir mi?" })
  ready(): Promise<OkResponse> {
    return this.healthService.checkReadiness();
  }
}
