import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import {
  ToBoolean,
  ToInt,
  ToUpperCase,
  Trim,
} from "#/core/decorators/index.js";
import { PageQueryDto } from "#/core/dtos/request/index.js";
import { StoreSource } from "#database/enums.js";

const STORE_SOURCES = Object.values(StoreSource);
export const STORE_PRICE_FILTERS = ["free", "paid"] as const;
export type StorePriceFilter = (typeof STORE_PRICE_FILTERS)[number];

/** Mağaza listesi: sınav/ders, kaynak, fiyat, arama. */
export class StoreItemListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({
    type: Number,
    description: "Sınav (alt dersleri dahil) veya ders",
  })
  @ToInt()
  @IsOptional()
  @IsInt({ message: "Kategori ID tam sayı olmalıdır" })
  @Min(1, { message: "Kategori ID en az 1 olmalıdır" })
  categoryId?: number;

  @ApiPropertyOptional({ type: String, enum: STORE_SOURCES })
  @Trim()
  @ToUpperCase()
  @IsOptional()
  @IsIn(STORE_SOURCES, { message: "Geçersiz içerik kaynağı" })
  source?: StoreSource;

  @ApiPropertyOptional({
    type: String,
    enum: STORE_PRICE_FILTERS,
    description: "`free` ücretsizler, `paid` ücretliler",
  })
  @Trim()
  @IsOptional()
  @IsIn(STORE_PRICE_FILTERS, {
    message: "Fiyat filtresi free veya paid olmalıdır",
  })
  price?: StorePriceFilter;

  @ApiPropertyOptional({ type: Boolean, description: "Yalnızca öne çıkanlar" })
  @ToBoolean()
  @IsOptional()
  @IsBoolean({ message: "Öne çıkan filtresi true/false olmalıdır" })
  featured?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: "Yalnızca sahip olunanlar (`true`)",
  })
  @ToBoolean()
  @IsOptional()
  @IsBoolean({ message: "Sahiplik filtresi true/false olmalıdır" })
  owned?: boolean;

  @ApiPropertyOptional({
    type: String,
    description: "Başlıkta ara",
    maxLength: 80,
  })
  @Trim()
  @IsOptional()
  @IsString({ message: "Arama metni metin olmalıdır" })
  @MaxLength(80, { message: "Arama metni en fazla 80 karakter olabilir" })
  q?: string;
}
