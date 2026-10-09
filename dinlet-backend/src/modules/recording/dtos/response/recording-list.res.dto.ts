import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import {
  DateTransformer,
  DateTransformerValueDto,
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";
import type { RecordingStatus } from "#database/enums.js";

/** "Kayıtlarım" satırı. */
export class RecordingListItemResDto {
  @ApiProperty({ type: Number })
  @Expose()
  sectionId!: number;

  @ApiProperty({ type: Number })
  @Expose()
  sectionOrder!: number;

  @ApiProperty({ type: String })
  @Expose()
  sectionTitle!: string;

  @ApiProperty({ type: Number })
  @Expose()
  documentId!: number;

  @ApiProperty({ type: String })
  @Expose()
  documentTitle!: string;

  @Expose()
  @EnumTransformer({ enumType: "RecordingStatus" })
  status!: EnumTransformerValueDto<RecordingStatus>;

  @ApiProperty({ type: Boolean })
  @Expose()
  useOwnVoice!: boolean;

  @ApiProperty({
    type: Number,
    description: "Hazırsa birleşik sesin, değilse kaydedilenlerin süresi",
  })
  @Expose()
  durationMs!: number;

  @ApiProperty({ type: Number })
  @Expose()
  recordedCount!: number;

  @ApiProperty({ type: Number })
  @Expose()
  totalCount!: number;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  updatedAt!: DateTransformerValueDto<string>;
}

export class RecordingSummaryResDto {
  @ApiProperty({ type: Number, description: "Hazır kayıtlı bölüm" })
  @Expose()
  readyCount!: number;

  @ApiProperty({ type: Number, description: "Yarım kalan" })
  @Expose()
  draftCount!: number;

  @ApiProperty({ type: Number, description: "Hazır kayıtların toplam süresi" })
  @Expose()
  totalDurationMs!: number;
}
