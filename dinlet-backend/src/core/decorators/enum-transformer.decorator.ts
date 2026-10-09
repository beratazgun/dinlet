import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { EnumTranslations } from "#/core/utils/enum-translations.js";

export class EnumTransformerValueDto<T = string> {
  @ApiProperty({ description: "Enum ham değeri", required: true })
  raw: string;

  @ApiProperty({ description: "Enum çevrilmiş değeri", required: true })
  display: T;
}

export interface EnumTransformerOptions<T> {
  /**
   * Enum tipinin adı (örn: "TicketStatus", "TicketPriority", "SlaStatus")
   * EnumTranslations.translate() metoduna geçirilecek
   */
  enumType: string;
  /**
   * Null/undefined değerleri atla
   */
  skipNullish?: boolean;
  /**
   * Hata durumunda varsayılan değer
   */
  defaultValue?: EnumTransformerValueDto<T>;
}

/**
 * Enum değerlerini { raw: değer, display: çevrilmişDeğer } formatında döndüren decorator
 */
export function EnumTransformer<T>(options: EnumTransformerOptions<T>) {
  return (target: any, propertyKey: string) => {
    // 1. Class-Transformer mantığı
    Transform(({ value }) => {
      try {
        if (value == null) {
          if (options.skipNullish) return value;
          if (options.defaultValue !== undefined) return options.defaultValue;
          return { raw: null, display: null };
        }

        const rawValue = String(value);
        const displayValue = EnumTranslations.translate(
          options.enumType,
          rawValue,
        );

        return {
          raw: rawValue,
          display: displayValue,
        };
      } catch (error) {
        if (options.defaultValue !== undefined) return options.defaultValue;

        return {
          raw: value != null ? String(value) : null,
          display: value != null ? String(value) : null,
        };
      }
    })(target, propertyKey);

    // 2. Swagger Dökümantasyon mantığı
    const enumValues = EnumTranslations.getEnumValues(options.enumType);

    ApiProperty({
      type: "object",
      properties: {
        raw: {
          type: "string",
          enum: enumValues.length > 0 ? enumValues : undefined,
          description: `${options.enumType} enum değeri`,
          nullable: false,
        },
        display: {
          type: "string",
          description: `${options.enumType} Türkçe karşılığı`,
          nullable: false,
        },
      },
      required: ["raw", "display"],
      nullable: options.skipNullish,
    } as any)(target, propertyKey);
  };
}
