import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
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
import { StoreSource } from "#database/enums.js";

const STORE_SOURCES = Object.values(StoreSource);
export const STORE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const STORE_PRODUCT_ID_PATTERN = /^[A-Za-z0-9._]{1,100}$/;

/**
 * Mağazaya içerik ekler. Kaynak, yöneticinin kendi kütüphanesindeki hazır
 * nottur; bölümleri, sesleri ve soruları kullanıcı kopyalarına taşınır.
 */
export class CreateStoreItemBodyDto {
  @ApiProperty({ type: Number, description: "Kaynak not (sizin, hazır)" })
  @IsInt({ message: "Not ID tam sayı olmalıdır" })
  @Min(1, { message: "Not ID en az 1 olmalıdır" })
  documentId!: number;

  @ApiProperty({ type: String, example: "İslamiyet Öncesi Türk Tarihi" })
  @Trim()
  @IsString({ message: "Başlık metin olmalıdır" })
  @MinLength(2, { message: "Başlık en az 2 karakter olmalıdır" })
  @MaxLength(120, { message: "Başlık en fazla 120 karakter olabilir" })
  title!: string;

  @ApiPropertyOptional({
    type: String,
    description: "Verilmezse başlıktan üretilir",
    example: "islamiyet-oncesi-turk-tarihi",
  })
  @Trim()
  @IsOptional()
  @Matches(STORE_SLUG_PATTERN, {
    message: "Kısa ad yalnızca küçük harf, rakam ve tire içerebilir",
  })
  @MaxLength(120, { message: "Kısa ad en fazla 120 karakter olabilir" })
  slug?: string;

  @ApiProperty({ type: String })
  @Trim()
  @IsString({ message: "Açıklama metin olmalıdır" })
  @MinLength(10, { message: "Açıklama en az 10 karakter olmalıdır" })
  @MaxLength(2_000, { message: "Açıklama en fazla 2000 karakter olabilir" })
  description!: string;

  @ApiProperty({ type: String, enum: STORE_SOURCES })
  @IsIn(STORE_SOURCES, { message: "Geçersiz içerik kaynağı" })
  source!: StoreSource;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Ortak yayınevi adı",
  })
  @Trim()
  @IsOptional()
  @IsString({ message: "Yayınevi adı metin olmalıdır" })
  @MaxLength(80, { message: "Yayınevi adı en fazla 80 karakter olabilir" })
  publisherName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "Dinlet editörleri",
  })
  @Trim()
  @IsOptional()
  @IsString({ message: "Hazırlayan metin olmalıdır" })
  @MaxLength(80, { message: "Hazırlayan en fazla 80 karakter olabilir" })
  credit?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "App Store / Play Store ürün kimliği; verilmezse ücretsiz",
    example: "dinlet_store_kpss_tarih_islamiyet_oncesi",
  })
  @Trim()
  @IsOptional()
  @Matches(STORE_PRODUCT_ID_PATTERN, { message: "Geçersiz ürün kimliği" })
  productId?: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: "Listede gösterilecek fiyat (TL)",
    example: 79.99,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "Fiyat en fazla 2 ondalıklı sayı olmalıdır" },
  )
  @Min(0, { message: "Fiyat negatif olamaz" })
  @Max(100_000, { message: "Fiyat çok yüksek" })
  priceTry?: number | null;

  @ApiPropertyOptional({
    type: Number,
    default: 1,
    description: "Satın almadan dinlenebilen ilk bölüm sayısı",
  })
  @IsOptional()
  @IsInt({ message: "Örnek bölüm sayısı tam sayı olmalıdır" })
  @Min(0, { message: "Örnek bölüm sayısı negatif olamaz" })
  @Max(20, { message: "Örnek bölüm sayısı en fazla 20 olabilir" })
  sampleSections?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: "Sınav ve ders kategorileri",
  })
  @IsOptional()
  @IsArray({ message: "Kategoriler dizi olmalıdır" })
  @ArrayMaxSize(10, { message: "En fazla 10 kategori seçilebilir" })
  @IsInt({ each: true, message: "Kategori ID tam sayı olmalıdır" })
  categoryIds?: number[];

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean({ message: "Öne çıkan true/false olmalıdır" })
  isFeatured?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean({ message: "Yayın durumu true/false olmalıdır" })
  isPublished?: boolean;

  @ApiPropertyOptional({ type: Number, default: 0, description: "Küçük önce" })
  @IsOptional()
  @IsInt({ message: "Sıra tam sayı olmalıdır" })
  position?: number;
}
