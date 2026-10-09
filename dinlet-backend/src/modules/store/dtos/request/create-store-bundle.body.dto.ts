import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import { Trim } from "#/core/decorators/index.js";

import {
  STORE_PRODUCT_ID_PATTERN,
  STORE_SLUG_PATTERN,
} from "./create-store-item.body.dto.js";

/** Paket: tek satın almayla birden çok ücretli içerik. */
export class CreateStoreBundleBodyDto {
  @ApiProperty({ type: String, example: "KPSS Tarih, tamamı" })
  @Trim()
  @IsString({ message: "Başlık metin olmalıdır" })
  @MinLength(2, { message: "Başlık en az 2 karakter olmalıdır" })
  @MaxLength(120, { message: "Başlık en fazla 120 karakter olabilir" })
  title!: string;

  @ApiPropertyOptional({
    type: String,
    description: "Verilmezse başlıktan üretilir",
  })
  @Trim()
  @IsOptional()
  @Matches(STORE_SLUG_PATTERN, {
    message: "Kısa ad yalnızca küçük harf, rakam ve tire içerebilir",
  })
  @MaxLength(120, { message: "Kısa ad en fazla 120 karakter olabilir" })
  slug?: string;

  @ApiProperty({ type: String, example: "Tek tek almaktan uygun." })
  @Trim()
  @IsString({ message: "Açıklama metin olmalıdır" })
  @MinLength(2, { message: "Açıklama en az 2 karakter olmalıdır" })
  @MaxLength(1_000, { message: "Açıklama en fazla 1000 karakter olabilir" })
  description!: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: "Gösterildiği sınav/ders",
  })
  @IsOptional()
  @IsInt({ message: "Kategori ID tam sayı olmalıdır" })
  @Min(1, { message: "Kategori ID en az 1 olmalıdır" })
  categoryId?: number | null;

  @ApiProperty({ type: String, example: "dinlet_store_bundle_kpss_tarih" })
  @Trim()
  @Matches(STORE_PRODUCT_ID_PATTERN, { message: "Geçersiz ürün kimliği" })
  productId!: string;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 249.99 })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "Fiyat en fazla 2 ondalıklı sayı olmalıdır" },
  )
  @Min(0, { message: "Fiyat negatif olamaz" })
  @Max(100_000, { message: "Fiyat çok yüksek" })
  priceTry?: number | null;

  @ApiProperty({ type: [Number], description: "Paketteki içerikler" })
  @IsArray({ message: "İçerikler dizi olmalıdır" })
  @ArrayMinSize(2, { message: "Pakette en az 2 içerik olmalıdır" })
  @ArrayMaxSize(50, { message: "Pakette en fazla 50 içerik olabilir" })
  @IsInt({ each: true, message: "İçerik ID tam sayı olmalıdır" })
  itemIds!: number[];

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean({ message: "Yayın durumu true/false olmalıdır" })
  isPublished?: boolean;

  @ApiPropertyOptional({ type: Number, default: 0, description: "Küçük önce" })
  @IsOptional()
  @IsInt({ message: "Sıra tam sayı olmalıdır" })
  position?: number;
}
