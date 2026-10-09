import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import { EmptyResDto } from "#/core/dtos/response/index.js";
import {
  PushTokenParamDto,
  RegisterPushTokenBodyDto,
} from "#/modules/notification/dtos/index.js";
import { PushTokenService } from "#/modules/notification/services/index.js";
import type { SessionUser } from "#/types/index.js";

@ApiTags("Notification")
@ApiBearerAuth()
@Controller("me/push-tokens")
export class PushTokenController {
  constructor(private readonly pushTokenService: PushTokenService) {}

  @Post()
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Push token kaydet",
    description:
      "Uygulama açılışında ve token değiştiğinde çağrılır. Token başka hesaptaysa bu hesaba taşınır.",
  })
  @ApiSuccessResponse({ description: "Cihaz kaydedildi" })
  @ApiErrorResponses(400, 401, 500)
  register(
    @Body() body: RegisterPushTokenBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.pushTokenService.register(body, user.id);
  }

  @Delete(":token")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Push token kaldır" })
  @ApiSuccessResponse({ status: 204, description: "Cihaz kaldırıldı" })
  @ApiErrorResponses(400, 401, 500)
  remove(
    @Param() params: PushTokenParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.pushTokenService.remove(params.token, user.id);
  }
}
