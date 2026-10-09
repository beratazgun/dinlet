import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  CdnUrl,
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";
import type { GenerationStatus } from "#database/enums.js";

/** Bölüm sonu sorusu (oynatıcı: soru → düşünme → cevap). */
export class SectionQuestionResDto {
  @ApiProperty({ type: Number })
  @Expose()
  id!: number;

  @ApiProperty({ type: Number })
  @Expose()
  order!: number;

  @ApiProperty({ type: String })
  @Expose()
  question!: string;

  @ApiProperty({ type: String })
  @Expose()
  answer!: string;

  @ApiProperty({ type: String })
  @Expose()
  detail!: string;

  @CdnUrl({ source: "questionAudioKey", description: "Sorunun sesi" })
  questionAudioUrl!: string;

  @ApiProperty({ type: Number })
  @Expose()
  questionDurationMs!: number;

  @CdnUrl({ source: "answerAudioKey", description: "Cevabın sesi" })
  answerAudioUrl!: string;

  @ApiProperty({ type: Number })
  @Expose()
  answerDurationMs!: number;
}

export class MnemonicResDto {
  @ApiProperty({ type: Number })
  @Expose()
  id!: number;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  sectionId!: number | null;

  @ApiProperty({ type: String, example: "Orhan Bey · fetih sırası" })
  @Expose()
  topic!: string;

  @ApiProperty({ type: String, example: "Bursa → İznik → İzmit" })
  @Expose()
  hook!: string;

  @ApiProperty({ type: String })
  @Expose()
  explanation!: string;

  @ApiProperty({
    type: Boolean,
    description: "Saklandı (bölüm sonunda okunur)",
  })
  @Expose()
  kept!: boolean;

  @CdnUrl({
    source: "audioKey",
    optional: true,
    description: "Saklanan kancanın sesi",
  })
  audioUrl!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  durationMs!: number | null;
}

export class MnemonicListResDto {
  @Expose()
  @EnumTransformer({ enumType: "GenerationStatus", skipNullish: true })
  status!: EnumTransformerValueDto<GenerationStatus> | null;

  @ApiProperty({ type: () => [MnemonicResDto] })
  @Expose()
  @Type(() => MnemonicResDto)
  items!: MnemonicResDto[];
}

export class QuickRequestResDto {
  @ApiProperty({ type: Number })
  @Expose()
  documentId!: number;

  @ApiProperty({
    type: Number,
    description: "Hızlı tekrara alınan bölüm sayısı",
  })
  @Expose()
  queuedSections!: number;
}

export class MnemonicRequestResDto {
  @ApiProperty({ type: Number })
  @Expose()
  documentId!: number;
}
