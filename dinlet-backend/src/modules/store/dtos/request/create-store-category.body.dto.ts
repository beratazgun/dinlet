import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import { Trim } from "#/core/decorators/index.js";

import { STORE_SLUG_PATTERN } from "./create-store-item.body.dto.js";

/** Sınav (üst kategorisiz) veya ders (üst kategori = sınav). */
export class CreateStoreCategoryBodyDto {
  @ApiProperty({ type: String, example: "Tarih" })
  @Trim()
  @IsString({ message: "Kategori adı metin olmalıdır" })
  @MinLength(1, { message: "Kategori adı boş olamaz" })
  @MaxLength(40, { message: "Kategori adı en fazla 40 karakter olabilir" })
  name!: string;

  @ApiPropertyOptional({
    type: String,
    description: "Verilmezse addan üretilir",
  })
  @Trim()
  @IsOptional()
  @Matches(STORE_SLUG_PATTERN, {
    message: "Kısa ad yalnızca küçük harf, rakam ve tire içerebilir",
  })
  @MaxLength(60, { message: "Kısa ad en fazla 60 karakter olabilir" })
  slug?: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: "Sınav kategorisi",
  })
  @IsOptional()
  @IsInt({ message: "Üst kategori ID tam sayı olmalıdır" })
  @Min(1, { message: "Üst kategori ID en az 1 olmalıdır" })
  parentId?: number | null;

  @ApiPropertyOptional({ type: Number, default: 0, description: "Küçük önce" })
  @IsOptional()
  @IsInt({ message: "Sıra tam sayı olmalıdır" })
  position?: number;
}
