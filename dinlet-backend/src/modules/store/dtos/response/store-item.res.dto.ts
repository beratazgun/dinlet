import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  EnumTransformer,
  type EnumTransformerValueDto,
  MoneyTransformer,
  MoneyTransformerValueDto,
} from "#/core/decorators/index.js";
import type { RewriteMode, StoreSource } from "#database/enums.js";

import { StoreCategoryResDto } from "./store-category.res.dto.js";

/** Mağaza listesindeki içerik satırı. */
export class StoreItemResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  id!: number;

  @ApiProperty({ type: String, example: "islamiyet-oncesi-turk-tarihi" })
  @Expose()
  slug!: string;

  @ApiProperty({ type: String, example: "İslamiyet Öncesi Türk Tarihi" })
  @Expose()
  title!: string;

  @Expose()
  @EnumTransformer({ enumType: "StoreSource" })
  source!: EnumTransformerValueDto<StoreSource>;

  @ApiProperty({ type: String, nullable: true, description: "Ortak yayınevi" })
  @Expose()
  publisherName!: string | null;

  @ApiProperty({ type: String, nullable: true, example: "Dinlet editörleri" })
  @Expose()
  credit!: string | null;

  @ApiProperty({
    type: () => [StoreCategoryResDto],
    description: "Sınav ve dersler",
  })
  @Expose()
  @Type(() => StoreCategoryResDto)
  categories!: StoreCategoryResDto[];

  @ApiProperty({ type: Number, example: 8 })
  @Expose()
  sectionCount!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Toplam ses süresi (ms)",
  })
  @Expose()
  totalDurationMs!: number | null;

  @ApiProperty({
    type: Number,
    example: 24,
    description: "Bölüm sonu sesli soruları",
  })
  @Expose()
  questionCount!: number;

  @Expose()
  @EnumTransformer({ enumType: "RewriteMode" })
  rewriteMode!: EnumTransformerValueDto<RewriteMode>;

  @ApiProperty({ type: Boolean, description: "Ücretsiz içerik" })
  @Expose()
  isFree!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Satın almada RevenueCat/StoreKit'e verilecek ürün kimliği",
  })
  @Expose()
  productId!: string | null;

  @Expose()
  @MoneyTransformer({ skipNullish: true })
  price!: MoneyTransformerValueDto | null;

  @ApiProperty({ type: Boolean })
  @Expose()
  isFeatured!: boolean;

  @ApiProperty({
    type: Boolean,
    description: "Kullanıcı içeriğe sahip (satın aldı veya ücretsiz ekledi)",
  })
  @Expose()
  isOwned!: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Kütüphanedeki kopyası ("Kütüphanende · Aç"); yoksa `null`',
  })
  @Expose()
  libraryDocumentId!: number | null;
}
