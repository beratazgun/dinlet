import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Public,
  RequestMetadata,
  Serialize,
  type RequestMetadata as RequestMetadataValue,
} from "#/core/decorators/index.js";
import { EmptyResDto } from "#/core/dtos/response/index.js";
import { OkResponse } from "#/core/http/index.js";
import {
  AccountIdParamDto,
  AppLinkTokenQueryDto,
  AuthSessionResDto,
  ChangePasswordBodyDto,
  DeleteAccountBodyDto,
  ForgotPasswordBodyDto,
  GetMeResDto,
  LoginBodyDto,
  RegisterBodyDto,
  ResendVerificationBodyDto,
  ResetPasswordBodyDto,
  SessionListQueryDto,
  TerminateSessionsBodyDto,
  UserSessionResDto,
  VerifyEmailBodyDto,
} from "#/modules/auth/dtos/index.js";
import {
  AuthAccountService,
  AuthPasswordService,
  AuthService,
  AuthSessionService,
} from "#/modules/auth/services/index.js";
import type { SessionUser } from "#/types/session-user.type.js";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordService: AuthPasswordService,
    private readonly sessionService: AuthSessionService,
    private readonly accountService: AuthAccountService,
  ) {}

  @Post("register")
  @Serialize(EmptyResDto)
  @Public()
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    medium: { limit: 5, ttl: 300_000 },
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Yeni kullanıcı kaydı" })
  @ApiBody({ type: RegisterBodyDto })
  @ApiSuccessResponse({ status: 201, description: "Kayıt başarılı" })
  @ApiErrorResponses(400, 409, 422, 500)
  register(
    @Body() body: RegisterBodyDto,
    @RequestMetadata() metadata: RequestMetadataValue,
  ) {
    return this.authService.register(body, metadata);
  }

  @Post("verify-email")
  @Serialize(AuthSessionResDto)
  @Public()
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: "X-Client", required: false, example: "mobile" })
  @ApiHeader({ name: "X-Device-Id", required: false })
  @ApiOperation({
    summary: "E-posta doğrulama",
    description:
      "Tek kullanımlık bağlantı token'ını doğrular ve oturum açar. `X-Client: mobile` ile çağrılırsa yanıtta `accessToken` döner.",
  })
  @ApiSuccessResponse({
    model: AuthSessionResDto,
    description: "E-posta doğrulandı, oturum açıldı",
  })
  @ApiErrorResponses(400, 404, 500)
  verifyEmail(
    @Body() body: VerifyEmailBodyDto,
    @RequestMetadata() metadata: RequestMetadataValue,
    @Req() request: FastifyRequest,
  ) {
    return this.authService.verifyEmail(body, metadata, request);
  }

  /**
   * E-postadaki onay bağlantısı buraya gelir ve uygulamaya yönlenir. E-posta
   * istemcileri özel şemalı (`dinletapp://`) bağlantıları çoğu zaman
   * tıklanabilir göstermediği için bağlantı https'tir; doğrulamayı uygulama
   * `POST /auth/verify-email` ile yapar (bu uç token'ı tüketmez).
   */
  @Get("verify-email/open")
  @Public()
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Onay bağlantısını uygulamada aç (yönlendirme)" })
  openVerificationLink(
    @Query() query: AppLinkTokenQueryDto,
    @Res() response: FastifyReply,
  ) {
    return response.redirect(
      this.authService.buildAppLink("verify-email", query.token),
      302,
    );
  }

  @Post("resend-verification")
  @Serialize(EmptyResDto)
  @Public()
  @Throttle({
    short: { limit: 2, ttl: 60_000 },
    medium: { limit: 5, ttl: 300_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Doğrulama emailini tekrar gönder" })
  @ApiSuccessResponse({ description: "Doğrulama emaili gönderildi" })
  @ApiErrorResponses(400, 404, 500)
  resendVerification(@Body() body: ResendVerificationBodyDto) {
    return this.authService.resendVerification(body);
  }

  @Post("forgot-password")
  @Serialize(EmptyResDto)
  @Public()
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    medium: { limit: 5, ttl: 300_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Şifre sıfırlama bağlantısı gönder" })
  @ApiSuccessResponse({ description: "Şifre sıfırlama bağlantısı gönderildi" })
  @ApiErrorResponses(400, 500)
  forgotPassword(@Body() body: ForgotPasswordBodyDto) {
    return this.passwordService.forgotPassword(body);
  }

  /**
   * Şifre sıfırlama e-postasındaki bağlantı; uygulamanın sıfırlama ekranına
   * yönlenir. Token'ı tüketmez, sıfırlama `POST /auth/reset-password` ile.
   */
  @Get("reset-password/open")
  @Public()
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Şifre sıfırlama bağlantısını uygulamada aç (yönlendirme)" })
  openPasswordResetLink(
    @Query() query: AppLinkTokenQueryDto,
    @Res() response: FastifyReply,
  ) {
    return response.redirect(
      this.authService.buildAppLink("reset-password", query.token),
      302,
    );
  }

  @Post("reset-password")
  @Serialize(EmptyResDto)
  @Public()
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    medium: { limit: 5, ttl: 300_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Şifre sıfırlama" })
  @ApiSuccessResponse({ description: "Şifre başarıyla güncellendi" })
  @ApiErrorResponses(400, 500)
  resetPassword(@Body() body: ResetPasswordBodyDto) {
    return this.passwordService.resetPassword(body);
  }

  @Post("login")
  @Public()
  @Serialize(AuthSessionResDto)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    medium: { limit: 10, ttl: 300_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Giriş",
    description:
      "Başarılı girişte imzalı, httpOnly oturum cookie'si döner. Oturum her istekte kendini tazeler (rolling). `X-Client: mobile` + `X-Device-Id` ile çağrılırsa yanıtta `accessToken` döner; sonraki isteklerde `Authorization: Bearer` ile gönderilir.",
  })
  @ApiHeader({ name: "X-Client", required: false, example: "mobile" })
  @ApiHeader({ name: "X-Device-Id", required: false })
  @ApiSuccessResponse({
    model: AuthSessionResDto,
    description: "Giriş başarılı",
  })
  @ApiErrorResponses(400, 401, 500)
  login(
    @Body() body: LoginBodyDto,
    @RequestMetadata() metadata: RequestMetadataValue,
    @Req() request: FastifyRequest,
  ) {
    return this.authService.login(body, metadata, request);
  }

  @Post("logout")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Çıkış" })
  @ApiSuccessResponse({ description: "Çıkış başarılı" })
  @ApiErrorResponses(401, 500)
  logout(@Req() request: FastifyRequest) {
    return this.sessionService.logout(request);
  }

  @Get("me")
  @Serialize(GetMeResDto)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Aktif kullanıcı bilgilerini getir" })
  @ApiSuccessResponse({
    model: GetMeResDto,
    description: "Kullanıcı bilgileri",
  })
  @ApiErrorResponses(401, 500)
  getMe(@CurrentUser() user: SessionUser) {
    return this.authService.getMe(user);
  }

  @Patch("change-password")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Şifre değiştir" })
  @ApiSuccessResponse({ description: "Şifre başarıyla güncellendi" })
  @ApiErrorResponses(400, 401, 422, 500)
  changePassword(
    @Body() body: ChangePasswordBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.passwordService.changePassword(body, user.id);
  }

  @Get("sessions")
  @Serialize(UserSessionResDto)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Açık oturumları listele" })
  @ApiSuccessResponse({
    model: UserSessionResDto,
    isArray: true,
    pagination: "offset",
    description: "Kullanıcının açık oturumları",
  })
  @ApiErrorResponses(401, 500)
  listSessions(
    @Query() query: SessionListQueryDto,
    @CurrentUser() user: SessionUser,
    @Req() request: FastifyRequest,
  ) {
    return this.sessionService.listSessions(request, user.id, query);
  }

  @Delete("sessions")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: "Seçili oturumları sonlandır",
    description:
      "Yalnızca kullanıcının kendi oturumları sonlandırılabilir. Listeye mevcut oturum da dahil edilirse oturum cookie'si temizlenir.",
  })
  @ApiSuccessResponse({ description: "Oturumlar sonlandırıldı" })
  @ApiErrorResponses(400, 401, 500)
  terminateSessions(
    @Body() body: TerminateSessionsBodyDto,
    @CurrentUser() user: SessionUser,
    @Req() request: FastifyRequest,
  ) {
    return this.sessionService.terminateSessions(request, body, user.id);
  }

  @Delete("linked-accounts/:accountId")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Bağlı hesabı kaldır" })
  @ApiSuccessResponse({
    status: 204,
    description: "Hesap bağlantısı kaldırıldı",
  })
  @ApiErrorResponses(401, 422, 500)
  unlinkAccount(
    @Param() params: AccountIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.accountService.unlinkAccount(user.id, params.accountId);
  }

  @Post("account/delete-request")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Hesap silme doğrulama kodu gönder" })
  @ApiSuccessResponse({ description: "Doğrulama kodu gönderildi" })
  @ApiErrorResponses(401, 500)
  requestAccountDeletion(
    @CurrentUser() user: SessionUser,
  ): Promise<OkResponse> {
    return this.accountService.requestAccountDeletion(user.id);
  }

  @Delete("account")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Hesabı soft delete ile sil" })
  @ApiSuccessResponse({ status: 204, description: "Hesap silindi" })
  @ApiErrorResponses(401, 422, 500)
  deleteAccount(
    @Body() body: DeleteAccountBodyDto,
    @CurrentUser() user: SessionUser,
    @Req() request: FastifyRequest,
  ) {
    return this.accountService.deleteAccount(request, user.id, body);
  }
}
