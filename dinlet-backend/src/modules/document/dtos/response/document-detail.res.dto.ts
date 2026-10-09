import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { DocumentProgressResDto } from "./document-progress.res.dto.js";
import { DocumentResDto } from "./document.res.dto.js";
import { SectionSummaryResDto } from "./section-summary.res.dto.js";

export class DocumentDetailTagResDto {
  @ApiProperty({ type: Number, example: 2 })
  @Expose()
  id!: number;

  @ApiProperty({ type: String, example: "Zor konular" })
  @Expose()
  name!: string;
}

/** Belge + bölüm listesi + ilerleme (`GET /documents/:id`). */
export class DocumentDetailResDto extends DocumentResDto {
  @ApiProperty({ type: () => DocumentProgressResDto })
  @Expose()
  @Type(() => DocumentProgressResDto)
  progress!: DocumentProgressResDto;

  @ApiProperty({ type: () => [SectionSummaryResDto] })
  @Expose()
  @Type(() => SectionSummaryResDto)
  sections!: SectionSummaryResDto[];

  @ApiProperty({ type: () => [DocumentDetailTagResDto] })
  @Expose()
  @Type(() => DocumentDetailTagResDto)
  tags!: DocumentDetailTagResDto[];
}
