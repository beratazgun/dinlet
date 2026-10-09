import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString } from "class-validator";

import { Trim } from "#/core/decorators/query-transform.decorator.js";
import { FilterDto } from "#/core/dtos/request/index.js";
import { EnumTranslations } from "#/core/utils/enum-translations.js";

/**
 * Enum seçenek listesi sorgusu.
 * `type`, çevirisi mevcut enum tiplerinden biri olmalıdır.
 */
export class GetEnumOptionsQueryDto extends FilterDto {
  @ApiProperty({ enum: Object.keys(EnumTranslations.translations) })
  @Trim()
  @IsString({ message: "Enum tipi metin olmalıdır" })
  @IsNotEmpty({ message: "Enum tipi boş olamaz" })
  @IsIn(Object.keys(EnumTranslations.translations), {
    message: "Geçersiz enum tipi",
  })
  type!: string;
}
