import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { FastifyRequest } from "fastify";

import type { RequestMetadata } from "#/core/decorators/index.js";
import type { OkResponse } from "#/core/http/index.js";
import type {
  AppleMobileLoginBodyDto,
  GoogleMobileLoginBodyDto,
} from "#/modules/auth/dtos/index.js";
import {
  USER_EMAIL_VERIFIED_EVENT,
  UserEmailVerifiedEvent,
} from "#/modules/auth/event/auth.events.js";
import { AuthUserRepository } from "#/modules/auth/repository/index.js";
import { AuthSessionService } from "#/modules/auth/services/auth-session.service.js";
import { SocialIdentityService } from "#/modules/auth/services/social-identity.service.js";
import type { SocialProfile } from "#/modules/auth/types/index.js";
import { UserStatus } from "#database/enums.js";

/**
 * Mobil yerel SDK'larla (Google Sign-In, Sign in with Apple) giriş.
 *
 * Token doğrulandıktan sonra kullanıcı sağlayıcı hesabıyla bulunur; yoksa
 * doğrulanmış e-postayla mevcut hesaba bağlanır ya da yeni hesap açılır.
 * Oturum, e-posta girişiyle aynı yoldan (`issueSession`) açılır.
 */
@Injectable()
export class AuthSocialService {
  constructor(
    private readonly identityService: SocialIdentityService,
    private readonly userRepository: AuthUserRepository,
    private readonly sessionService: AuthSessionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async loginWithGoogle(
    body: GoogleMobileLoginBodyDto,
    metadata: RequestMetadata,
    request: FastifyRequest,
  ): Promise<OkResponse> {
    const profile = await this.identityService.verifyGoogle(body.idToken);
    return this.login(profile, metadata, request);
  }

  async loginWithApple(
    body: AppleMobileLoginBodyDto,
    metadata: RequestMetadata,
    request: FastifyRequest,
  ): Promise<OkResponse> {
    const profile = await this.identityService.verifyApple(
      body.identityToken,
      body.nonce,
      { name: body.name, surname: body.surname },
    );
    return this.login(profile, metadata, request);
  }

  private async login(
    profile: SocialProfile,
    metadata: RequestMetadata,
    request: FastifyRequest,
  ): Promise<OkResponse> {
    const user = await this.userRepository.findOrCreateSocialUser(profile);
    if (!user) {
      throw new UnprocessableEntityException(
        "Sağlayıcı doğrulanmış bir e-posta adresi paylaşmadı; hesap oluşturulamadı.",
      );
    }
    if (user.deletedAt) throw new UnauthorizedException("Hesabınız silinmiş.");
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        "Hesabınızın durumundan dolayı giriş yapılamıyor.",
      );
    }
    if (!user.role) {
      throw new UnauthorizedException("Kullanıcı rolü bulunamadı.");
    }

    await this.userRepository.updateLastLogin(user.id, profile.provider);

    if (user.isNewUser) {
      this.eventEmitter.emit(
        USER_EMAIL_VERIFIED_EVENT,
        new UserEmailVerifiedEvent(user.id),
      );
    }

    return this.sessionService.issueSession(
      request,
      { id: user.id, role: user.role },
      metadata,
    );
  }
}
