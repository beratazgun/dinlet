import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import {
  DateTransformer,
  DateTransformerValueDto,
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";
import type {
  DocumentStatus,
  ExtractQuality,
  RewriteMode,
} from "#database/enums.js";

/** Belge özeti (liste ve detay ortak alanları). */
export class DocumentResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  id!: number;

  @ApiProperty({ type: String, example: "Osmanlı Kuruluş Dönemi" })
  @Expose()
  title!: string;

  @Expose()
  @EnumTransformer({ enumType: "DocumentStatus" })
  status!: EnumTransformerValueDto<DocumentStatus>;

  @ApiProperty({ type: Number, example: 24 })
  @Expose()
  pageCount!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Hazır olunca toplam ses süresi (ms)",
  })
  @Expose()
  totalDurationMs!: number | null;

  @Expose()
  @EnumTransformer({ enumType: "RewriteMode" })
  rewriteMode!: EnumTransformerValueDto<RewriteMode>;

  @Expose()
  @EnumTransformer({ enumType: "ExtractQuality" })
  extractQuality!: EnumTransformerValueDto<ExtractQuality>;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  failureReason!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: "Klasör; yoksa `null`" })
  @Expose()
  folderId!: number | null;

  @ApiProperty({ type: Boolean, description: "★ Favori" })
  @Expose()
  isFavorite!: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Mağazadan eklendiyse mağaza içeriği; kendi yüklediği notta `null`",
  })
  @Expose()
  storeItemId!: number | null;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  createdAt!: DateTransformerValueDto<string>;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  updatedAt!: DateTransformerValueDto<string>;
}
