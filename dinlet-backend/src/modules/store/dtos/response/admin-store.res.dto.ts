import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import {
  DateTransformer,
  DateTransformerValueDto,
} from "#/core/decorators/index.js";

import { StoreBundleDetailResDto } from "./store-bundle.res.dto.js";
import { StoreItemResDto } from "./store-item.res.dto.js";

/** Yönetim görünümü: yayın durumu ve kaynak not. */
export class AdminStoreItemResDto extends StoreItemResDto {
  @ApiProperty({ type: String })
  @Expose()
  description!: string;

  @ApiProperty({ type: Number, description: "Kaynak not" })
  @Expose()
  documentId!: number;

  @ApiProperty({ type: Number })
  @Expose()
  sampleSections!: number;

  @ApiProperty({ type: Boolean })
  @Expose()
  isPublished!: boolean;

  @ApiProperty({ type: Number })
  @Expose()
  position!: number;

  @ApiProperty({ type: DateTransformerValueDto, nullable: true })
  @Expose()
  @DateTransformer({
    format: "dd MMMM yyyy HH:mm",
    withRawAndDisplay: true,
    skipNullish: true,
  })
  publishedAt!: DateTransformerValueDto<string> | null;
}

export class AdminStoreBundleResDto extends StoreBundleDetailResDto {
  @ApiProperty({ type: Boolean })
  @Expose()
  isPublished!: boolean;

  @ApiProperty({ type: Number })
  @Expose()
  position!: number;
}
