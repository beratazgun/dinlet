import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import type { EnvType } from "#config/env.validation.js";
import { EmailQueueService } from "#/infra/queue/index.js";
import { RedisLoginAttemptHelper } from "#/infra/redis/helpers/redis-login-attempt.helper.js";
import {
  ACCOUNT_DELETION_REQUESTED_EVENT,
  ACCOUNT_LOCKED_EVENT,
  AccountDeletionRequestedEvent,
  AccountLockedEvent,
  NEW_DEVICE_LOGIN_EVENT,
  NewDeviceLoginEvent,
  PASSWORD_CHANGED_EVENT,
  PASSWORD_RESET_REQUESTED_EVENT,
  PasswordChangedEvent,
  PasswordResetRequestedEvent,
  USER_EMAIL_VERIFIED_EVENT,
  USER_REGISTERED_EVENT,
  UserEmailVerifiedEvent,
  UserRegisteredEvent,
} from "#/modules/auth/event/auth.events.js";
import { AuthUserRepository } from "#/modules/auth/repository/index.js";

@Injectable()
export class AuthEventHandler {
  private readonly logger = new Logger(AuthEventHandler.name);

  constructor(
    private readonly configService: ConfigService<EnvType>,
    private readonly userRepository: AuthUserRepository,
    private readonly emailQueue: EmailQueueService,
    private readonly loginAttempts: RedisLoginAttemptHelper,
  ) {}

  @OnEvent(USER_REGISTERED_EVENT)
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    const user = await this.userRepository.findById(event.userId);
    if (!user)
      return this.logger.warn(
        `Doğrulama kullanıcısı bulunamadı: ${event.userId}`,
      );

    // https bağlantısı API'den uygulamanın derin bağlantısına yönlenir
    // (`GET /auth/verify-email/open`); e-posta istemcileri özel şemalı
    // bağlantıları çoğu zaman tıklanabilir göstermez.
    const serviceDomain = this.configService.get("SERVICE_DOMAIN", {
      infer: true,
    });
    await this.enqueueEmail({
      to: user.email,
      code: "VERIFICATION_EMAIL",
      variables: {
        name: user.name,
        surname: user.surname,
        confirmUrl: `${serviceDomain}/api/v1/auth/verify-email/open?token=${encodeURIComponent(event.verificationToken)}`,
      },
    });
  }

  @OnEvent(PASSWORD_RESET_REQUESTED_EVENT)
  async handlePasswordResetRequested(
    event: PasswordResetRequestedEvent,
  ): Promise<void> {
    const user = await this.userRepository.findById(event.userId);
    if (!user)
      return this.logger.warn(
        `Şifre sıfırlama kullanıcısı bulunamadı: ${event.userId}`,
      );

    // Onay e-postasındaki gibi https bağlantısı uygulamaya yönlenir
    // (`GET /auth/reset-password/open`).
    const serviceDomain = this.configService.get("SERVICE_DOMAIN", {
      infer: true,
    });
    await this.enqueueEmail({
      to: user.email,
      code: "PASSWORD_RESET_EMAIL",
      variables: {
        userName: `${user.name ?? ""} ${user.surname ?? ""}`.trim(),
        resetLink: `${serviceDomain}/api/v1/auth/reset-password/open?token=${encodeURIComponent(event.resetToken)}`,
        expiresIn: "15 dakika",
      },
    });
  }

  @OnEvent(PASSWORD_CHANGED_EVENT)
  async handlePasswordChanged(event: PasswordChangedEvent): Promise<void> {
    const user = await this.userRepository.findById(event.userId);
    if (!user)
      return this.logger.warn(
        `Şifre değişikliği kullanıcısı bulunamadı: ${event.userId}`,
      );

    await this.enqueueEmail({
      to: user.email,
      code: "PASSWORD_CHANGED",
      variables: { name: user.name, surname: user.surname },
    });
  }

  /**
   * Şifre değişince (sıfırlama dahil) giriş kilidini kaldırır: kilitlenen
   * kullanıcının önerilen çıkış yolu şifresini sıfırlamaktır ve sıfırladıktan
   * sonra kilidin dolmasını beklememelidir.
   */
  @OnEvent(PASSWORD_CHANGED_EVENT)
  async handlePasswordChangedLockout(
    event: PasswordChangedEvent,
  ): Promise<void> {
    try {
      const user = await this.userRepository.findById(event.userId);
      if (user) await this.loginAttempts.reset(user.email);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  @OnEvent(ACCOUNT_DELETION_REQUESTED_EVENT)
  async handleAccountDeletionRequested(
    event: AccountDeletionRequestedEvent,
  ): Promise<void> {
    const user = await this.userRepository.findById(event.userId);
    if (!user)
      return this.logger.warn(
        `Hesap silme kullanıcısı bulunamadı: ${event.userId}`,
      );

    await this.enqueueEmail({
      to: user.email,
      code: "ACCOUNT_DELETION_EMAIL",
      variables: {
        code: event.confirmationCode,
        name: user.name,
        surname: user.surname,
        expiresIn: "5 dakika",
      },
    });
  }

  @OnEvent(ACCOUNT_LOCKED_EVENT)
  async handleAccountLocked(event: AccountLockedEvent): Promise<void> {
    const user = await this.userRepository.findById(event.userId);
    if (!user)
      return this.logger.warn(
        `Kilitlenen hesap kullanıcısı bulunamadı: ${event.userId}`,
      );

    const frontendUrl = this.configService.get("FRONTEND_URL", { infer: true });
    await this.enqueueEmail({
      to: user.email,
      code: "ACCOUNT_LOCKED",
      variables: {
        name: user.name,
        surname: user.surname,
        lockedForMinutes: Math.ceil(event.lockedForSeconds / 60),
        ipAddress: event.ipAddress,
        resetLink: `${frontendUrl}/forgot-password`,
      },
    });
  }

  @OnEvent(NEW_DEVICE_LOGIN_EVENT)
  async handleNewDeviceLogin(event: NewDeviceLoginEvent): Promise<void> {
    const user = await this.userRepository.findById(event.userId);
    if (!user)
      return this.logger.warn(
        `Yeni cihaz girişi kullanıcısı bulunamadı: ${event.userId}`,
      );

    const frontendUrl = this.configService.get("FRONTEND_URL", { infer: true });
    await this.enqueueEmail({
      to: user.email,
      code: "NEW_DEVICE_LOGIN",
      variables: {
        name: user.name,
        surname: user.surname,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        loggedInAt: event.loggedInAt,
        sessionsLink: `${frontendUrl}/settings/sessions`,
      },
    });
  }

  @OnEvent(USER_EMAIL_VERIFIED_EVENT)
  async handleUserEmailVerified(event: UserEmailVerifiedEvent): Promise<void> {
    const user = await this.userRepository.findById(event.userId);
    if (!user)
      return this.logger.warn(
        `Hoş geldin e-postası kullanıcısı bulunamadı: ${event.userId}`,
      );

    await this.enqueueEmail({
      to: user.email,
      code: "WELCOME",
      variables: { name: user.name, surname: user.surname },
    });
  }

  private async enqueueEmail(params: {
    to: string;
    code: string;
    variables: Record<string, unknown>;
  }): Promise<void> {
    // Gönderimi doğrudan yapmıyoruz; kuyruğa alıyoruz. Asıl gönderim
    // retry/backoff ile EmailProcessor'da, request dışında yapılır.
    try {
      await this.emailQueue.enqueueEmail(params);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
