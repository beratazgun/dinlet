import { applyDecorators, Type } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";
import { ErrorResDto } from "#/core/dtos/response/error.res.dto.js";
import { ValidationErrorResDto } from "#/core/dtos/response/validation-error.res.dto.js";

// ApiResponse `schema` alanı internal SchemaObject ister; local alias kullanıyoruz.
type SwaggerSchema = Record<string, unknown>;

/**
 * Belirli bir status için varsayılan RFC 7807 gövdesinin dışında özel bir
 * response yapısı dökümante etmek için kullanılır.
 */
export interface ErrorResponseOverride {
  status: number;
  description?: string;
  /** Bu status'a özel response DTO'su (varsayılan `ErrorResDto` yerine). */
  type?: Type<unknown>;
  /** Tamamen özel bir OpenAPI şeması (DTO'ya sığmayan gövdeler için). */
  schema?: SwaggerSchema;
}

/** Sayı (varsayılan gövde) veya override objesi. */
export type ErrorResponseInput = number | ErrorResponseOverride;

// Status → varsayılan açıklama + DTO.
const DEFAULT_META: Record<
  number,
  { description: string; type: Type<unknown> }
> = {
  400: { description: "Hatalı istek (Bad Request)", type: ErrorResDto },
  401: { description: "Yetkisiz erişim (Unauthorized)", type: ErrorResDto },
  402: {
    description: "Kota veya abonelik yetersiz (Payment Required)",
    type: ErrorResDto,
  },
  403: { description: "Erişim reddedildi (Forbidden)", type: ErrorResDto },
  404: { description: "Kaynak bulunamadı (Not Found)", type: ErrorResDto },
  409: { description: "Çakışma (Conflict)", type: ErrorResDto },
  413: { description: "Dosya çok büyük (Payload Too Large)", type: ErrorResDto },
  422: {
    description: "Doğrulama hatası (Unprocessable Entity)",
    type: ValidationErrorResDto,
  },
  429: { description: "Çok fazla istek (Too Many Requests)", type: ErrorResDto },
  500: {
    description: "Sunucu hatası (Internal Server Error)",
    type: ErrorResDto,
  },
};

/**
 * RFC 7807 Problem Details uyumlu hata yanıtları için Swagger dekoratörü.
 *
 * Parametre verilmezse varsayılan olarak 400, 422 ve 500 eklenir. Her argüman
 * ya bir status kodu (varsayılan gövde) ya da özel gövde tanımlayan bir override
 * objesi olabilir.
 *
 * @example
 * // Varsayılan gövdeler
 * @ApiErrorResponses(400, 409, 500)
 *
 * @example
 * // 409 için özel DTO, diğerleri varsayılan
 * @ApiErrorResponses(400, { status: 409, type: EmailConflictResDto, description: 'Email zaten kayıtlı' }, 500)
 */
export function ApiErrorResponses(...responses: ErrorResponseInput[]) {
  const inputs: ErrorResponseInput[] =
    responses.length > 0 ? responses : [400, 422, 500];

  const decorators = inputs.map((input) => {
    const status = typeof input === "number" ? input : input.status;
    const override = typeof input === "number" ? undefined : input;
    const fallback = DEFAULT_META[status];

    const description =
      override?.description ?? fallback?.description ?? `Hata (${status})`;

    // Özel şema verildiyse type'ı görmezden gel (ApiResponse ikisini birlikte kabul etmez).
    if (override?.schema) {
      return ApiResponse({ status, description, schema: override.schema });
    }

    return ApiResponse({
      status,
      description,
      type: override?.type ?? fallback?.type ?? ErrorResDto,
    });
  });

  return applyDecorators(...decorators);
}
