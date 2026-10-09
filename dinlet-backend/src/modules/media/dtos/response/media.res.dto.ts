import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import {
  CdnUrl,
  DateTransformer,
  DateTransformerValueDto,
} from "#/core/decorators/index.js";

export class MediaResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  id!: number;

  @CdnUrl({ source: "storageKey", description: "CDN URL'i" })
  url!: string;

  @ApiProperty({ type: String, example: "profil.jpg" })
  @Expose()
  fileName!: string;

  @ApiProperty({ type: String, example: "image/jpeg" })
  @Expose()
  mimeType!: string;

  @ApiProperty({ type: Number, description: "Bayt", example: 248_331 })
  @Expose()
  size!: number;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  createdAt!: DateTransformerValueDto<string>;
}
