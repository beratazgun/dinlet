import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { FastifyRequest } from "fastify";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  RequestMetadata,
  Serialize,
  type RequestMetadata as RequestMetadataValue,
} from "#/core/decorators/index.js";
import { EmptyResDto } from "#/core/dtos/response/index.js";
import {
  AcceptConsentsBodyDto,
  GetMeConsentsDto,
} from "#/modules/auth/dtos/index.js";
import {
  AuthAccountService,
  ConsentService,
} from "#/modules/auth/services/index.js";
import type { SessionUser } from "#/types/session-user.type.js";

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
export class UserController {
  constructor(
    private readonly accountService: AuthAccountService,
    private readonly consentService: ConsentService,
  ) {}

  @Post("me/consents")
  @Serialize(GetMeConsentsDto)
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "KVKK onaylarını kaydet",
    description:
      "Apple / Google ile açılan hesaplar ve metin sürümü değiştiğinde. `/auth/me` yanıtındaki `consents` alanlarından biri `false` ise uygulama bu adımı gösterir. Yurt dışına aktarım rızası isteğe bağlıdır ve geri çekilebilir (`false`).",
  })
  @ApiSuccessResponse({
    model: GetMeConsentsDto,
    description: "Onaylar kaydedildi; güncel durum döner",
  })
  @ApiErrorResponses(401, 422, 429, 500)
  acceptConsents(
    @CurrentUser() user: SessionUser,
    @Body() body: AcceptConsentsBodyDto,
    @RequestMetadata() metadata: RequestMetadataValue,
  ) {
    return this.consentService.recordAcceptance(
      user.id,
      { crossBorderTransfer: body.crossBorderTransferConsent },
      metadata,
    );
  }

  @Post("me/delete-request")
  @Serialize(EmptyResDto)
  @Throttle({ short: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Hesap silme doğrulama kodu gönder",
    description:
      "Hesap silme işlemi için kullanıcıya e-posta ile 6 haneli doğrulama kodu (ACCOUNT_DELETION_EMAIL) gönderir.",
  })
  @ApiSuccessResponse({ description: "Doğrulama kodu e-postaya gönderildi" })
  @ApiErrorResponses(401, 422, 500)
  requestAccountDeletion(@CurrentUser() user: SessionUser) {
    return this.accountService.requestAccountDeletion(user.id);
  }

  @Delete("me")
  @Serialize(EmptyResDto)
  @Throttle({ short: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Hesabımı ve tüm verilerimi sil",
    description:
      "Hesap hemen kapanır ve tüm oturumlar sonlanır. Notlar, PDF'ler ve ses dosyaları en geç 7 gün içinde kalıcı silinir. Aktif abonelik mağazadan ayrıca iptal edilmelidir.",
  })
  @ApiSuccessResponse({ status: 204, description: "Hesap silindi" })
  @ApiErrorResponses(401, 422, 429, 500)
  deleteMe(@CurrentUser() user: SessionUser, @Req() request: FastifyRequest) {
    return this.accountService.eraseAccount(request, user.id);
  }
}
