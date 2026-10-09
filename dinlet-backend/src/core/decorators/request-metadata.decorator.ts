import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

export interface RequestMetadata {
  ipAddress: string;
  userAgent: string | null;
}

/**
 * İsteği yapan istemcinin IP adresi. Öncelik Cloudflare'in kendi yazdığı
 * `cf-connecting-ip` başlığındadır: Cloudflare `x-forwarded-for`'u istemcinin
 * gönderdiğinin sonuna eklediği için oradaki ilk adres sahtelenebilir.
 * Cloudflare yoksa (yerel/test) `x-forwarded-for`'un ilk adresi, o da yoksa
 * soket adresi kullanılır. Hız sınırı, denetim ve oturum bu tek yardımcıyı
 * kullanır.
 */
export function resolveClientIp(request: FastifyRequest): string {
  const cloudflareIp = request.headers['cf-connecting-ip'];
  if (typeof cloudflareIp === 'string' && cloudflareIp.trim()) {
    return cloudflareIp.trim();
  }
  return (
    (request.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() ||
    request.socket?.remoteAddress ||
    request.ip ||
    'unknown'
  );
}

/**
 * İsteği yapan istemcinin IP/user-agent bilgisini çıkarır.
 * Decorator dışında (ör. denetim hook'u) da bu tek yardımcı kullanılır.
 */
export function extractClientMetadata(
  request: FastifyRequest,
): RequestMetadata {
  const ipAddress = resolveClientIp(request);

  return { ipAddress, userAgent: request.headers['user-agent'] || null };
}

export const RequestMetadata = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestMetadata =>
    extractClientMetadata(ctx.switchToHttp().getRequest<FastifyRequest>()),
);
