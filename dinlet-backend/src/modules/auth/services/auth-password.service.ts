import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OkResponse } from "#/core/http/index.js";
import { hashPassword, verifyPassword } from "#/core/utils/hash.js";
import { AccountType, VerificationTokenType } from "#database/enums.js";
import { RedisGetMeHelper } from "#/infra/redis/helpers/redis-get-me.helper.js";
import { RedisSessionHelper } from "#/infra/redis/helpers/redis-session.helper.js";
import type {
  ChangePasswordBodyDto,
  ForgotPasswordBodyDto,
  ResetPasswordBodyDto,
} from "#/modules/auth/dtos/index.js";
import {
  PASSWORD_CHANGED_EVENT,
  PASSWORD_RESET_REQUESTED_EVENT,
  PasswordChangedEvent,
  PasswordResetRequestedEvent,
} from "#/modules/auth/event/auth.events.js";
import {
  AuthAccountRepository,
  AuthTokenRepository,
  AuthUserRepository,
} from "#/modules/auth/repository/index.js";
import { DateManager } from "#/core/utils/date-manager.js";

@Injectable()
export class AuthPasswordService {
  constructor(
    private readonly userRepository: AuthUserRepository,
    private readonly tokenRepository: AuthTokenRepository,
    private readonly accountRepository: AuthAccountRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly publicMeCache: RedisGetMeHelper,
    private readonly dateManager: DateManager,
    private readonly sessionHelper: RedisSessionHelper,
  ) {}

  async forgotPassword(body: ForgotPasswordBodyDto): Promise<OkResponse> {
    const successMessage =
      "E-posta adresinize şifre sıfırlama bağlantısı gönderildi.";
    const user = await this.userRepository.findByEmail(body.email);
    if (!user?.isEmailVerified || user.accounts.length === 0) {
      return new OkResponse(successMessage);
    }

    const token =
      (await this.tokenRepository.findActiveVerificationTokenByUserId(
        user.id,
        VerificationTokenType.PASSWORD_RESET,
      )) ?? (await this.tokenRepository.createPasswordResetToken(user.id));

    this.eventEmitter.emit(
      PASSWORD_RESET_REQUESTED_EVENT,
      new PasswordResetRequestedEvent(user.id, token.token),
    );
    return new OkResponse(successMessage);
  }

  async resetPassword(body: ResetPasswordBodyDto): Promise<OkResponse> {
    if (body.newPassword !== body.confirmPassword) {
      throw new BadRequestException("Şifreler eşleşmiyor.");
    }

    const token = await this.tokenRepository.findVerificationToken(
      body.token,
      VerificationTokenType.PASSWORD_RESET,
    );
    if (!token) {
      throw new BadRequestException(
        "Geçersiz veya kullanılmış şifre sıfırlama bağlantısı.",
      );
    }
    if (this.dateManager.isExpired(token.expiresAt)) {
      throw new BadRequestException(
        "Şifre sıfırlama bağlantısının süresi dolmuş. Lütfen yeni bir talep oluşturun.",
      );
    }

    await this.tokenRepository.completePasswordReset(
      token.userId,
      token.id,
      await hashPassword(body.newPassword),
    );
    // Şifre, hesabın ele geçirildiği düşünülerek sıfırlanmış olabilir: açık
    // oturumların hepsi kapanır, giriş yeni şifreyle yapılır.
    await this.sessionHelper.destroyAll(token.userId);
    this.eventEmitter.emit(
      PASSWORD_CHANGED_EVENT,
      new PasswordChangedEvent(token.userId),
    );
    return new OkResponse(
      "Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.",
    );
  }

  async changePassword(
    body: ChangePasswordBodyDto,
    userId: number,
  ): Promise<OkResponse> {
    if (body.newPassword !== body.confirmPassword) {
      throw new BadRequestException("Şifreler eşleşmiyor.");
    }

    const user = await this.userRepository.findUserForPasswordChange(userId);
    if (!user) throw new UnauthorizedException("Kullanıcı bulunamadı");

    const local = user.accounts.find(
      (account) => account.type === AccountType.LOCAL,
    );
    const hashedPassword = await hashPassword(body.newPassword);

    if (!local) {
      await this.accountRepository.createLocalAccount(
        userId,
        user.email,
        hashedPassword,
      );
      await this.publicMeCache.invalidate(userId);
      this.emitPasswordChanged(userId);
      return new OkResponse("Şifre başarıyla belirlendi.");
    }

    if (!body.currentPassword) {
      throw new BadRequestException("Mevcut şifre zorunludur.");
    }
    if (!local.password) {
      throw new BadRequestException("Kimlik bilgileri bulunamadı");
    }
    if (!(await verifyPassword(body.currentPassword, local.password))) {
      throw new BadRequestException("Mevcut şifre hatalı");
    }

    await this.accountRepository.updatePassword(userId, hashedPassword);
    this.emitPasswordChanged(userId);
    return new OkResponse("Şifre başarıyla güncellendi.");
  }

  private emitPasswordChanged(userId: number): void {
    this.eventEmitter.emit(
      PASSWORD_CHANGED_EVENT,
      new PasswordChangedEvent(userId),
    );
  }
}
