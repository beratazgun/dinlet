import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { CdnUrl } from "#/core/decorators/index.js";

import { StoreBundleResDto } from "./store-bundle.res.dto.js";
import { StoreItemResDto } from "./store-item.res.dto.js";

/** İçindekiler satırı; örnek bölümün sesi satın almadan dinlenebilir. */
export class StoreSectionResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  order!: number;

  @ApiProperty({ type: String, example: "Asya Hun Devleti" })
  @Expose()
  title!: string;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  durationMs!: number | null;

  @ApiProperty({
    type: Boolean,
    description: "Ücretsiz dinlenebilen örnek bölüm",
  })
  @Expose()
  isSample!: boolean;

  @CdnUrl({
    source: "sampleAudioKey",
    optional: true,
    description: "Örnek bölümün sesi; kilitli bölümde `null`",
  })
  audioUrl!: string | null;
}

/** İçerik detayı (ücretsiz içerik ve satın alma ekranı). */
export class StoreItemDetailResDto extends StoreItemResDto {
  @ApiProperty({ type: String })
  @Expose()
  description!: string;

  @ApiProperty({ type: Number, example: 24 })
  @Expose()
  pageCount!: number;

  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  sampleSections!: number;

  @ApiProperty({ type: Boolean, description: "Hızlı tekrar sürümü hazır" })
  @Expose()
  hasQuickVersion!: boolean;

  @ApiProperty({ type: () => [StoreSectionResDto] })
  @Expose()
  @Type(() => StoreSectionResDto)
  sections!: StoreSectionResDto[];

  @ApiProperty({
    type: () => [StoreBundleResDto],
    description: "İçeriği kapsayan paketler",
  })
  @Expose()
  @Type(() => StoreBundleResDto)
  bundles!: StoreBundleResDto[];
}
