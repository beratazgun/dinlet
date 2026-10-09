import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import { SubscriptionResDto } from "#/modules/billing/dtos/index.js";
import { SubscriptionService } from "#/modules/billing/services/index.js";
import type { SessionUser } from "#/types/index.js";

@ApiTags("Subscription")
@ApiBearerAuth()
@Controller("me/subscription")
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @Serialize(SubscriptionResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Aboneliğim ve kotam",
    description: "Etkin plan, dönem sonu, bu ayki sayfa kullanımı ve kalan kota.",
  })
  @ApiSuccessResponse({ model: SubscriptionResDto, description: "Abonelik" })
  @ApiErrorResponses(401, 500)
  getMine(@CurrentUser() user: SessionUser) {
    return this.subscriptionService.getMine(user.id);
  }
}
