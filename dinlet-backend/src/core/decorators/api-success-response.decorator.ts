import { applyDecorators, Type } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";
import { SuccessResDto } from "#/core/dtos/response/success.res.dto.js";
import { CursorPaginationMetaResDto } from "#/core/dtos/response/cursor-pagination-meta.res.dto.js";
import { PaginationMetaResDto } from "#/core/dtos/response/pagination-meta.res.dto.js";

// Swagger `schema.properties` field-tipi `SchemaObject | ReferenceObject` ister;
// her ikisi de internal modülde — local alias kullanıyoruz.
type SwaggerSchemaProperty = { $ref: string } | Record<string, unknown>;

interface SuccessResponseOptions<T extends Type<any>> {
  model?: T;
  status?: number;
  description?: string;
  isArray?: boolean;
  /**
   * Verilirse response.meta.pagination alanı servisin kullandığı Paginator
   * moduna göre dökümante edilir: `"offset"` → PaginationMetaResDto
   * (`apply`/`applyToArray`), `"cursor"` → CursorPaginationMetaResDto
   * (`applyCursor`). `isArray` ile birlikte kullanılır.
   */
  pagination?: "offset" | "cursor";
}

/**
 * Başarılı yanıtları (SuccessResponseBody) standart bir şekilde dökümante etmek için kullanılır.
 * Verilen DTO'yu otomatik olarak SuccessResDto sarmalayıcısı içine alır.
 *
 * @example
 * @ApiSuccessResponse({ model: GetMeResDto, description: 'Kullanıcı bilgileri' })
 *
 * @example
 * // Verisiz başarı yanıtı (Sadece message dönerse)
 * @ApiSuccessResponse({ description: 'İşlem başarılı' })
 */
export function ApiSuccessResponse<T extends Type<any>>(
  options: SuccessResponseOptions<T> = {},
) {
  const {
    model,
    status = 200,
    description = "Başarılı işlem",
    isArray = false,
    pagination,
  } = options;

  if (!model) {
    return applyDecorators(
      ApiResponse({
        status,
        description,
        type: SuccessResDto,
      }),
    );
  }

  const dataSchema = isArray
    ? { type: "array" as const, items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  const extraProps: Record<string, SwaggerSchemaProperty> = {
    data: dataSchema,
  };
  const paginationModel =
    pagination === "cursor"
      ? CursorPaginationMetaResDto
      : pagination === "offset"
        ? PaginationMetaResDto
        : null;
  if (paginationModel) {
    extraProps.meta = {
      type: "object",
      properties: {
        pagination: { $ref: getSchemaPath(paginationModel) },
      },
    };
  }

  const extraModels = paginationModel
    ? [SuccessResDto, paginationModel, model]
    : [SuccessResDto, model];

  return applyDecorators(
    ApiExtraModels(...extraModels),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessResDto) },
          {
            required: ["data"],
            properties: extraProps,
          },
        ],
      },
    }),
  );
}
