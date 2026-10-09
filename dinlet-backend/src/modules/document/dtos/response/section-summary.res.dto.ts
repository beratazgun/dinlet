import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import {
  CdnUrl,
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";
import type { GenerationStatus, SectionStatus } from "#database/enums.js";

export class SectionSummaryResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  id!: number;

  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  order!: number;

  @ApiProperty({ type: String, example: "Kuruluş Dönemi" })
  @Expose()
  title!: string;

  @Expose()
  @EnumTransformer({ enumType: "SectionStatus" })
  status!: EnumTransformerValueDto<SectionStatus>;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  durationMs!: number | null;

  @CdnUrl({
    source: "audioKey",
    optional: true,
    description: "MP3'ün CDN adresi; ses hazır değilse `null`",
  })
  audioUrl!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Sesin sonundaki tekrar özetinin süresi (özet kapalıyken atlanır)",
  })
  @Expose()
  recapDurationMs!: number | null;

  @Expose()
  @EnumTransformer({ enumType: "GenerationStatus", skipNullish: true })
  quickStatus!: EnumTransformerValueDto<GenerationStatus> | null;

  @ApiProperty({ type: Number, nullable: true, description: "Hızlı tekrar sesinin süresi" })
  @Expose()
  quickDurationMs!: number | null;

  @CdnUrl({
    source: "quickAudioKey",
    optional: true,
    description: "Hızlı tekrar sesi (Dinleme modu: hızlı)",
  })
  quickAudioUrl!: string | null;
}
