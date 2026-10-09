import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { resolveClientIp } from '#/core/decorators/request-metadata.decorator.js';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected errorMessage =
    'Çok fazla istek gönderildi. Lütfen kısa bir süre sonra tekrar deneyin.';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (e) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: this.errorMessage,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Sayaç anahtarı: gerçek istemci IP'si (Cloudflare başlığı öncelikli). */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return resolveClientIp(req as FastifyRequest);
  }

  handleRequest(requestProps: ThrottlerRequest) {
    return super.handleRequest(requestProps);
  }
}
