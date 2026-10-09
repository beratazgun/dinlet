import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import {
  CdnUrl,
  DateTransformer,
  DateTransformerValueDto,
} from "#/core/decorators/index.js";

/** "Kaldığın yerden devam et" listesindeki bölüm. */
export class ContinueItemResDto {
  @ApiProperty({ type: Number, example: 3 })
  @Expose()
  sectionId!: number;

  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  sectionOrder!: number;

  @ApiProperty({ type: String, example: "Kuruluş Dönemi" })
  @Expose()
  sectionTitle!: string;

  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  documentId!: number;

  @ApiProperty({ type: String, example: "Osmanlı Kuruluş Dönemi" })
  @Expose()
  documentTitle!: string;

  @ApiProperty({
    type: Number,
    example: 9,
    description: "Belgenin toplam bölüm sayısı",
  })
  @Expose()
  sectionCount!: number;

  @ApiProperty({ type: Number, example: 95_000 })
  @Expose()
  positionMs!: number;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  durationMs!: number | null;

  @CdnUrl({ source: "audioKey", optional: true, description: "MP3'ün CDN adresi" })
  audioUrl!: string | null;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  updatedAt!: DateTransformerValueDto<string>;
}
