import type { FastifyRequest } from "fastify";

import type { HateoasLink, HateoasLinks } from "#/core/context/index.js";
import type {
  CursorPaginationMeta,
  PaginationMeta,
} from "#/core/utils/paginator.js";

/**
 * İsteğin tam URL'i. Statik/global bir context kullanılmaz — eşzamanlı
 * isteklerde birbirinin linkini ezmesin diye her istek için yeniden üretilir.
 */
export function buildFullUrl(request: FastifyRequest): string {
  const host = request.headers.host || "localhost";
  return `${request.protocol || "http"}://${host}${request.url}`;
}

/** Mevcut URL'in query parametrelerini değiştirerek yeni bir URL üretir. */
function withQuery(
  fullUrl: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const url = new URL(fullUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Sayfalı bir koleksiyon için sayfalama moduna uygun linkleri üretir. */
export function buildPaginationLinks(
  fullUrl: string,
  pagination: PaginationMeta | CursorPaginationMeta,
): Partial<HateoasLinks> {
  return pagination.kind === "cursor"
    ? buildCursorLinks(fullUrl, pagination)
    : buildOffsetLinks(fullUrl, pagination);
}

/** Offset: self/first/last/next/prev. */
function buildOffsetLinks(
  fullUrl: string,
  pagination: PaginationMeta,
): Partial<HateoasLinks> {
  const link = (page: number): HateoasLink => ({
    href: withQuery(fullUrl, { page, limit: pagination.limit }),
    method: "GET",
  });

  return {
    self: { href: fullUrl, method: "GET" },
    first: link(1),
    ...(pagination.totalPages > 0 ? { last: link(pagination.totalPages) } : {}),
    ...(pagination.hasNextPage ? { next: link(pagination.page + 1) } : {}),
    ...(pagination.hasPrevPage ? { prev: link(pagination.page - 1) } : {}),
  };
}

/** Keyset: self/first/next. İmleç tek yönlüdür; `last` ve `prev` yoktur. */
function buildCursorLinks(
  fullUrl: string,
  pagination: CursorPaginationMeta,
): Partial<HateoasLinks> {
  const link = (cursor: string | null): HateoasLink => ({
    href: withQuery(fullUrl, { cursor, limit: pagination.limit }),
    method: "GET",
  });

  return {
    self: { href: fullUrl, method: "GET" },
    first: link(null),
    ...(pagination.nextCursor ? { next: link(pagination.nextCursor) } : {}),
  };
}
