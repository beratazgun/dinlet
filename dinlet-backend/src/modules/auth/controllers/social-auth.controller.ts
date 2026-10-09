import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { FastifyRequest } from "fastify";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  Public,
  RequestMetadata,
  Serialize,
  type RequestMetadata as RequestMetadataValue,
} from "#/core/decorators/index.js";
import {
  AppleMobileLoginBodyDto,
  AuthSessionResDto,
  GoogleMobileLoginBodyDto,
} from "#/modules/auth/dtos/index.js";
import { AuthSocialService } from "#/modules/auth/services/index.js";

/**
 * Mobil yerel SDK'larla sosyal giriş. İstemci `X-Client: mobile` ve
 * `X-Device-Id` gönderir; yanıtta `accessToken` döner.
 */
@ApiTags("Auth")
@ApiHeader({ name: "X-Client", required: true, example: "mobile" })
@ApiHeader({
  name: "X-Device-Id",
  required: true,
  description: "Kurulumda üretilen kalıcı cihaz kimliği (UUID)",
})
@Controller("auth")
export class SocialAuthController {
  constructor(private readonly socialService: AuthSocialService) {}

  @Post("google/mobile")
  @Public()
  @Serialize(AuthSessionResDto)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    medium: { limit: 10, ttl: 300_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Google ile giriş (mobil)",
    description:
      "Yerel Google Sign-In'den gelen `idToken` doğrulanır; hesap yoksa açılır, doğrulanmış e-postayla eşleşen hesap varsa bağlanır.",
  })
  @ApiSuccessResponse({
    model: AuthSessionResDto,
    description: "Giriş başarılı",
  })
  @ApiErrorResponses(400, 401, 403, 422, 500)
  loginWithGoogle(
    @Body() body: GoogleMobileLoginBodyDto,
    @RequestMetadata() metadata: RequestMetadataValue,
    @Req() request: FastifyRequest,
  ) {
    return this.socialService.loginWithGoogle(body, metadata, request);
  }

  @Post("apple/mobile")
  @Public()
  @Serialize(AuthSessionResDto)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    medium: { limit: 10, ttl: 300_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Apple ile giriş (mobil)",
    description:
      "`identityToken` Apple anahtarlarıyla, `nonce` istemcinin ürettiği değerle doğrulanır. Apple e-posta ve adı yalnızca ilk girişte verir.",
  })
  @ApiSuccessResponse({
    model: AuthSessionResDto,
    description: "Giriş başarılı",
  })
  @ApiErrorResponses(400, 401, 403, 422, 500)
  loginWithApple(
    @Body() body: AppleMobileLoginBodyDto,
    @RequestMetadata() metadata: RequestMetadataValue,
    @Req() request: FastifyRequest,
  ) {
    return this.socialService.loginWithApple(body, metadata, request);
  }
}
