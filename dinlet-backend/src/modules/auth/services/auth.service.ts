import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { EnvType } from "#config/env.validation.js";
import type { FastifyRequest } from "fastify";
import type { RequestMetadata } from "#/core/decorators/index.js";
import { TooManyAttemptsException } from "#/core/exceptions/index.js";
import { CreatedResponse, OkResponse } from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { hashPassword, verifyPassword } from "#/core/utils/hash.js";
import {
  AccountType,
  UserStatus,
  VerificationTokenType,
  type UserStatus as UserStatusValue,
} from "#database/enums.js";
import { RedisGetMeHelper } from "#/infra/redis/helpers/redis-get-me.helper.js";
import { RedisLoginAttemptHelper } from "#/infra/redis/helpers/redis-login-attempt.helper.js";
import type {
  LoginBodyDto,
  RegisterBodyDto,
  ResendVerificationBodyDto,
  VerifyEmailBodyDto,
} from "#/modules/auth/dtos/index.js";
import {
  ACCOUNT_LOCKED_EVENT,
  AccountLockedEvent,
  USER_EMAIL_VERIFIED_EVENT,
  USER_REGISTERED_EVENT,
  UserEmailVerifiedEvent,
  UserRegisteredEvent,
} from "#/modules/auth/event/auth.events.js";
import {
  AuthTokenRepository,
  AuthUserRepository,
} from "#/modules/auth/repository/index.js";
import { AuthSessionService } from "#/modules/auth/services/auth-session.service.js";
import { ConsentService } from "#/modules/auth/services/consent.service.js";
import {
  accountLockedMessage,
  isLockoutThresholdReached,
  LOGIN_FAILURE_WINDOW_SECONDS,
  LOGIN_LOCK_SECONDS,
} from "#/modules/auth/utils/login-lockout.util.js";
import type { SessionUser } from "#/types/session-user.type.js";

/** E-posta bağlantılarının açtığı uygulama ekranları. */
export type AppLinkScreen = "verify-email" | "reset-password";

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: AuthUserRepository,
    private readonly tokenRepository: AuthTokenRepository,
    private readonly sessionService: AuthSessionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly publicMeCache: RedisGetMeHelper,
    private readonly loginAttempts: RedisLoginAttemptHelper,
    private readonly dateManager: DateManager,
    private readonly consentService: ConsentService,
    private readonly configService: ConfigService<EnvType>,
  ) {}

  async getMe(sessionUser: SessionUser): Promise<OkResponse> {
    const cached = await this.publicMeCache.get(sessionUser.id);
    if (cached) return new OkResponse("Kullanıcı bilgileri", cached);

    const user = await this.userRepository.findUserWithDetails(sessionUser.id);
    if (!user) throw new UnauthorizedException("Kullanıcı bulunamadı");
    const result = {
      id: user.id,
      email: user.email,
      name: user.name,
      surname: user.surname,
      username: user.username,
      bio: user.bio,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      lastLoginAt: user.lastLoginAt,
      lastLoginMethod: user.lastLoginMethod,
      consents: await this.consentService.getSummary(user.id),
      linkedProviders: user.accounts.map((account) => ({
        id: account.id,
        type: account.type,
        createdAt: account.createdAt,
      })),
    };

    await this.publicMeCache.set(user.id, result);
    return new OkResponse("Kullanıcı bilgileri", result);
  }

  /**
   * E-posta ile kayıt. Hesap `PENDING` açılır; KVKK onayları aynı
   * transaction'da defterlenir ve onay bağlantısı e-postayla gönderilir.
   * Giriş, e-posta doğrulanınca açılır (doğrulama bağlantısı oturumu da açar).
   */
  async register(
    body: RegisterBodyDto,
    metadata: RequestMetadata,
  ): Promise<CreatedResponse> {
    if (await this.userRepository.findByEmail(body.email)) {
      throw new ConflictException({
        message: "Bu e-posta adresiyle zaten bir hesap var.",
        code: "EMAIL_TAKEN",
      });
    }

    const result = await this.userRepository.createUser({
      name: body.name,
      surname: body.surname,
      email: body.email,
      password: await hashPassword(body.password),
      consents: this.consentService.registrationRecords(
        { crossBorderTransfer: body.crossBorderTransferConsent },
        metadata,
      ),
    });
    this.eventEmitter.emit(
      USER_REGISTERED_EVENT,
      new UserRegisteredEvent(result.user.id, result.verificationToken.token),
    );
    return new CreatedResponse(
      "Hesabın oluşturuldu. E-postana gönderdiğimiz bağlantıyla hesabını onayla.",
    );
  }

  /**
   * E-posta + parola ile giriş.
   *
   * Aynı e-posta için art arda başarısız denemeler hesabı geçici olarak
   * kilitler (`login-lockout.util.ts`). Kilitliyken parola doğru olsa bile
   * giriş reddedilir; kilit süre dolunca veya şifre değişince kalkar.
   */
  async login(
    body: LoginBodyDto,
    metadata: RequestMetadata,
    request: FastifyRequest,
  ): Promise<OkResponse> {
    const lockedFor = await this.loginAttempts.lockedForSeconds(body.email);
    if (lockedFor > 0) {
      throw new TooManyAttemptsException(
        accountLockedMessage(lockedFor),
        lockedFor,
      );
    }

    const user = await this.userRepository.findLoginUserByEmail(body.email);
    if (!user) return this.failLogin(body.email, null, metadata);

    const local = user.accounts.find(
      (account) => account.type === AccountType.LOCAL,
    );
    if (!local?.password) {
      if (user.accounts.some((account) => account.type !== AccountType.LOCAL)) {
        throw new UnprocessableEntityException(
          "Bu hesap Google veya Apple ile oluşturulmuş. Lütfen aynı yöntemle giriş yapın.",
        );
      }
      throw this.invalidCredentials();
    }

    if (!(await verifyPassword(body.password, local.password))) {
      return this.failLogin(body.email, user.id, metadata);
    }
    if (!user.isEmailVerified) {
      // Mobil uygulama bu kodla kullanıcıyı onay ekranına yönlendirir.
      throw new BadRequestException({
        message:
          "E-posta adresin henüz onaylanmadı. Gelen kutundaki bağlantıya dokun.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(this.getLoginErrorMessage(user.status));
    }
    if (!user.role)
      throw new UnauthorizedException("Kullanıcı rolü bulunamadı");

    await this.loginAttempts.reset(body.email);
    await this.userRepository.updateLastLogin(user.id, AccountType.LOCAL);
    return this.sessionService.issueSession(
      request,
      { id: user.id, role: user.role },
      metadata,
    );
  }

  /**
   * E-postayı doğrular ve oturum açar: tek kullanımlık bağlantıya sahip olmak
   * e-postanın sahibi olmayı kanıtlar (sihirli bağlantı). Mobilde yanıt
   * `accessToken` taşır, uygulama doğrudan içeri geçer.
   */
  async verifyEmail(
    body: VerifyEmailBodyDto,
    metadata: RequestMetadata,
    request: FastifyRequest,
  ): Promise<OkResponse> {
    const token = await this.tokenRepository.findVerificationToken(
      body.token,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    if (!token) throw new BadRequestException("Geçersiz doğrulama token'ı.");
    if (this.dateManager.isExpired(token.expiresAt)) {
      throw new BadRequestException(
        "Doğrulama linkinin süresi dolmuş. Lütfen yeni bir doğrulama linki talep edin.",
      );
    }

    const user = await this.userRepository.findById(token.userId);
    if (!user) throw new BadRequestException("Geçersiz doğrulama token'ı.");
    const sendWelcome =
      !user.isEmailVerified && user.status === UserStatus.PENDING;

    await this.tokenRepository.completeEmailVerification(user.id, token.id);
    if (sendWelcome) {
      this.eventEmitter.emit(
        USER_EMAIL_VERIFIED_EVENT,
        new UserEmailVerifiedEvent(user.id),
      );
    }

    const sessionUser = await this.userRepository.findSessionUser(user.id);
    if (!sessionUser?.role || sessionUser.status !== UserStatus.ACTIVE) {
      return new OkResponse("E-posta adresin onaylandı. Giriş yapabilirsin.");
    }
    await this.userRepository.updateLastLogin(user.id, AccountType.LOCAL);
    return this.sessionService.issueSession(
      request,
      { id: sessionUser.id, role: sessionUser.role },
      metadata,
      "E-posta adresin onaylandı.",
    );
  }

  /**
   * Uygulamanın derin bağlantısı, ör. `dinletapp://verify-email?token=…`.
   * Ekran adı uygulamadaki route ile aynıdır.
   */
  buildAppLink(screen: AppLinkScreen, token: string): string {
    const scheme = this.configService.getOrThrow("APP_DEEP_LINK_SCHEME", {
      infer: true,
    });
    return `${scheme}://${screen}?token=${encodeURIComponent(token)}`;
  }

  async resendVerification(
    body: ResendVerificationBodyDto,
  ): Promise<OkResponse> {
    const message = "Doğrulama linki email adresine tekrar gönderildi.";
    const user = await this.userRepository.findByEmail(body.email);
    if (!user) return new OkResponse(message);

    if (!user.isEmailVerified) {
      const token =
        (await this.tokenRepository.findActiveVerificationTokenByUserId(
          user.id,
          VerificationTokenType.EMAIL_VERIFICATION,
        )) ?? (await this.tokenRepository.recreateVerificationToken(user.id));
      this.eventEmitter.emit(
        USER_REGISTERED_EVENT,
        new UserRegisteredEvent(user.id, token.token),
      );
    }
    return new OkResponse(message);
  }

  /** Başarısızlığı sayar; eşik aşıldıysa kilitler. Her durumda hata fırlatır. */
  private async failLogin(
    email: string,
    userId: number | null,
    metadata: RequestMetadata,
  ): Promise<never> {
    const failures = await this.loginAttempts.recordFailure(
      email,
      LOGIN_FAILURE_WINDOW_SECONDS,
    );
    if (!isLockoutThresholdReached(failures)) throw this.invalidCredentials();

    await this.loginAttempts.lock(email, LOGIN_LOCK_SECONDS);
    if (userId !== null) {
      this.eventEmitter.emit(
        ACCOUNT_LOCKED_EVENT,
        new AccountLockedEvent(userId, LOGIN_LOCK_SECONDS, metadata.ipAddress),
      );
    }
    throw new TooManyAttemptsException(
      accountLockedMessage(LOGIN_LOCK_SECONDS),
      LOGIN_LOCK_SECONDS,
    );
  }

  private invalidCredentials(): UnprocessableEntityException {
    return new UnprocessableEntityException(
      "Geçersiz e-posta adresi veya şifre.",
    );
  }

  private getLoginErrorMessage(status: UserStatusValue): string {
    return status === UserStatus.PENDING
      ? "Hesabınızın aktifleşmesi için e-posta adresinizi doğrulamanız gerekmektedir."
      : "Hesabınızın durumundan dolayı giriş yapılamıyor.";
  }
}
