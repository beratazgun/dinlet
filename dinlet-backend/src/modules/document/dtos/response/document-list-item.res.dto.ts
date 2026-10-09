import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { DocumentResDto } from "./document.res.dto.js";

/** Bölüm sayıları: "4/11 bölüm dinlenebilir", "1 bölüm seslendirilemedi". */
export class DocumentSectionCountsResDto {
  @ApiProperty({
    type: Number,
    example: 11,
    description: "Toplam bölüm (bölümleme bitmeden 0)",
  })
  @Expose()
  total!: number;

  @ApiProperty({ type: Number, example: 4, description: "Sesi hazır bölüm" })
  @Expose()
  ready!: number;

  @ApiProperty({
    type: Number,
    example: 0,
    description: "Kalıcı olarak seslendirilemeyen bölüm",
  })
  @Expose()
  failed!: number;
}

/** Kütüphane listesindeki belge: özet + ilerleme + bölüm sayıları. */
export class DocumentListItemResDto extends DocumentResDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: 100, example: 62 })
  @Expose()
  progressPercent!: number;

  @ApiProperty({ type: () => DocumentSectionCountsResDto })
  @Expose()
  @Type(() => DocumentSectionCountsResDto)
  sections!: DocumentSectionCountsResDto;
}
