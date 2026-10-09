import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";

import { Public, Serialize } from "#/core/decorators/index.js";
import { EmptyResDto } from "#/core/dtos/response/index.js";
import { RevenueCatWebhookService } from "#/modules/billing/services/index.js";

/**
 * RevenueCat webhook'u. Oturum değil, panelde tanımlanan gizli
 * `Authorization` başlığıyla doğrulanır. Gövde RevenueCat'in şemasıdır
 * (bizim DTO'muz değil); servis içinde ayrıştırılır.
 */
@ApiExcludeController()
@Controller("webhooks/revenuecat")
export class RevenueCatWebhookController {
  constructor(private readonly webhookService: RevenueCatWebhookService) {}

  @Post()
  @Public()
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.OK)
  handle(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhookService.handle(authorization, body);
  }
}
