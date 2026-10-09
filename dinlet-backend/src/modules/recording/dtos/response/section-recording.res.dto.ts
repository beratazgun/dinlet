import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  CdnUrl,
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";
import type { RecordingStatus } from "#database/enums.js";

export class RecordingClipResDto {
  @CdnUrl({ source: "audioKey", description: "Paragraf kaydı" })
  audioUrl!: string;

  @ApiProperty({ type: Number })
  @Expose()
  durationMs!: number;
}

/** Kaydedilecek parça: paragraf veya tekrar özeti. */
export class RecordingPartResDto {
  @ApiProperty({ type: Number, example: 0 })
  @Expose()
  position!: number;

  @ApiProperty({ type: String, enum: ["PARAGRAPH", "RECAP"] })
  @Expose()
  kind!: "PARAGRAPH" | "RECAP";

  @ApiProperty({ type: String, description: "Ekranda okunacak metin" })
  @Expose()
  text!: string;

  @ApiProperty({ type: () => RecordingClipResDto, nullable: true })
  @Expose()
  @Type(() => RecordingClipResDto)
  clip!: RecordingClipResDto | null;
}

/** Bölümün kaydı (kayıt ve gözden geçirme ekranı). */
export class SectionRecordingResDto {
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
  @EnumTransformer({ enumType: "RecordingStatus", skipNullish: true })
  status!: EnumTransformerValueDto<RecordingStatus> | null;

  @ApiProperty({ type: Boolean, description: "Bu bölümde kendi sesin çalar" })
  @Expose()
  useOwnVoice!: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Birleşik sesin süresi",
  })
  @Expose()
  durationMs!: number | null;

  @CdnUrl({
    source: "audioKey",
    optional: true,
    description: "Birleşik ses (hazırsa)",
  })
  audioUrl!: string | null;

  @ApiProperty({ type: Number, example: 3 })
  @Expose()
  recordedCount!: number;

  @ApiProperty({ type: Number, example: 6 })
  @Expose()
  totalCount!: number;

  @ApiProperty({
    type: Number,
    description: "Kaydedilen kliplerin toplam süresi",
  })
  @Expose()
  recordedDurationMs!: number;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  failureReason!: string | null;

  @ApiProperty({ type: () => [RecordingPartResDto] })
  @Expose()
  @Type(() => RecordingPartResDto)
  parts!: RecordingPartResDto[];
}
