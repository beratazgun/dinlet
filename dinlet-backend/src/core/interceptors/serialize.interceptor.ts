import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  Type,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import type { FastifyRequest } from "fastify";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { CursorPaginationMetaResDto } from "#/core/dtos/response/cursor-pagination-meta.res.dto.js";
import { PaginationMetaResDto } from "#/core/dtos/response/pagination-meta.res.dto.js";
import {
  buildFullUrl,
  buildPaginationLinks,
  HttpSuccess,
} from "#/core/http/index.js";
import { getSessionUser } from "#/infra/session/index.js";

/**
 * class-transformer'a verilmeden önce bigint ve Decimal benzeri değerleri
 * JSON'da güvenli string değerlere dönüştürür.
 */
function sanitizeValues(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === "bigint") return data.toString();

  if (
    typeof data === "object" &&
    data.constructor.name === "Decimal" &&
    "toString" in data &&
    typeof data.toString === "function"
  ) {
    return data.toString();
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeValues);
  }

  if (data instanceof Date) {
    return data;
  }

  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = sanitizeValues(value);
    }
    return result;
  }

  return data;
}

export class SerializeInterceptor implements NestInterceptor {
  constructor(private readonly dto: Type<unknown>) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Role bilgisini oturumdan al
    const roleCode = getSessionUser(request)?.role.code ?? "USER";

    return next.handle().pipe(
      map((data) => {
        // Eğer data bir HttpSuccess instance'ı ise, içindeki veriyi serialize et
        if (data instanceof HttpSuccess) {
          const response = data as HttpSuccess<unknown>;
          const originalData = sanitizeValues(response.data);
          const serializedData = plainToInstance(this.dto, originalData, {
            excludeExtraneousValues: true,
            groups: [roleCode],
          });

          // HttpSuccess nesnesinin data'sını güncelliyoruz
          response.data = serializedData;

          // meta.pagination varsa HATEOAS linklerini istekten türet ve moduna
          // göre PaginationMetaResDto (offset) veya CursorPaginationMetaResDto
          // (keyset) ile şekillendir. DTO'lar nextUrl/prevUrl'yi `_links`'ten üretir.
          const pagination = response.meta?.pagination;
          if (pagination) {
            const metaDto: Type<unknown> =
              pagination.kind === "cursor"
                ? CursorPaginationMetaResDto
                : PaginationMetaResDto;
            response.meta!.pagination = plainToInstance(
              metaDto,
              {
                ...pagination,
                _links: buildPaginationLinks(buildFullUrl(request), pagination),
              },
              { excludeExtraneousValues: true },
            );
          }
          return response;
        }

        // Normal bir obje ise direkt serialize et
        return plainToInstance(this.dto, sanitizeValues(data), {
          excludeExtraneousValues: true,
          groups: [roleCode],
        });
      }),
    );
  }
}
