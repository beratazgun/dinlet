import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import type { EnvType } from "#config/env.validation.js";
import { IS_PUBLIC_KEY } from "#/core/constants/index.js";
import { SecurityBreachException } from "#/core/exceptions/index.js";
import {
  buildSessionClearCookieOptions,
  DEVICE_ID_HEADER,
  getSessionUser,
  isSessionDeviceMismatch,
  normalizeDeviceId,
} from "#/infra/session/index.js";

/**
 * Oturumu doğrulayan global guard.
 *
 * Oturum kimliği cookie'den ya da (mobilde) `Authorization: Bearer`
 * başlığından gelir; ikisi de aynı Redis store'undan `@fastify/session`
 * tarafından `onRequest` hook'unda yüklenir. Burada oturumda kimlik bulunup
 * bulunmadığına ve oturumun açıldığı cihazdan gelip gelmediğine bakılır.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService<EnvType>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (!getSessionUser(request)) {
      if (isPublic) return true;
      throw new UnauthorizedException("Oturum açmanız gerekmektedir");
    }

    // Çalınmış oturum tespiti: oturum başka bir cihazdan kullanılıyorsa
    // store'dan silinir ve cookie temizlenir.
    if (
      isSessionDeviceMismatch(
        {
          userAgent: request.session.get("userAgent"),
          deviceId: request.session.get("deviceId"),
        },
        {
          userAgent: request.headers["user-agent"],
          deviceId: normalizeDeviceId(request.headers[DEVICE_ID_HEADER]),
        },
      )
    ) {
      await request.session.destroy();
      throw new SecurityBreachException([
        {
          name: this.configService.getOrThrow("SESSION_COOKIE_NAME", {
            infer: true,
          }),
          options: buildSessionClearCookieOptions(this.configService),
        },
      ]);
    }

    return true;
  }
}
