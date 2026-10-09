import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { getSessionUser } from "#/infra/session/index.js";
import type { SessionUser } from "#/types/session-user.type.js";

/**
 * Oturumdaki kullanıcı bilgisini çeker.
 * AuthGuard, kimliksiz isteklerde zaten 401 döndürür.
 *
 * @example
 * @Get('/me')
 * async getMe(@CurrentUser() user: SessionUser) { ... }
 *
 * @example
 * // Tek bir alanı almak için
 * async logout(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  <K extends keyof SessionUser>(data: K | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = getSessionUser(request);

    return data ? user?.[data] : user;
  },
);
