import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AppAbility } from "#/core/casl/index.js";
import {
  ApiErrorResponses,
  ApiSuccessResponse,
  AuditOptions,
  CheckPolicies,
  Serialize,
} from "#/core/decorators/index.js";
import type { OkResponse } from "#/core/http/index.js";
import {
  AuditLogDetailResDto,
  AuditLogIdParamDto,
  AuditLogListQueryDto,
  AuditLogResDto,
} from "#/infra/audit/dtos/index.js";
import { AuditLogService } from "#/infra/audit/services/index.js";

/**
 * Denetim kayıtları (salt okunur). Kayıt güncelleme/silme ucu bilerek yoktur.
 * Bu uçların okunması da denetlenir; yalnızca (büyük) yanıt gövdeleri saklanmaz.
 */
@ApiTags("Audit")
@ApiCookieAuth()
@AuditOptions({ captureResponseBody: false })
@Controller("audit-logs")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Serialize(AuditLogResDto)
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability: AppAbility) => ability.can("list", "AuditLog"))
  @ApiOperation({ summary: "Denetim kayıtlarını listele" })
  @ApiSuccessResponse({
    model: AuditLogResDto,
    isArray: true,
    pagination: "cursor",
    description: "Denetim kayıtları",
  })
  @ApiErrorResponses(400, 401, 403, 500)
  list(@Query() query: AuditLogListQueryDto): Promise<OkResponse> {
    return this.auditLogService.list(query);
  }

  @Get(":id")
  @Serialize(AuditLogDetailResDto)
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability: AppAbility) => ability.can("read", "AuditLog"))
  @ApiOperation({ summary: "Denetim kaydını istek/yanıt gövdeleriyle getir" })
  @ApiSuccessResponse({
    model: AuditLogDetailResDto,
    description: "Denetim kaydı",
  })
  @ApiErrorResponses(400, 401, 403, 404, 500)
  get(@Param() params: AuditLogIdParamDto): Promise<OkResponse> {
    return this.auditLogService.get(params.id);
  }
}
