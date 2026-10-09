import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { CdnUrl } from "#/core/decorators/index.js";

export class ReviewDayResDto {
  @ApiProperty({ type: String, example: "2026-10-05" })
  @Expose()
  day!: string;

  @ApiProperty({ type: String, example: "Pt" })
  @Expose()
  label!: string;

  @ApiProperty({ type: Boolean })
  @Expose()
  done!: boolean;

  @ApiProperty({ type: Boolean })
  @Expose()
  isToday!: boolean;
}

export class ReviewItemResDto {
  @ApiProperty({ type: Number, example: 3 })
  @Expose()
  sectionId!: number;

  @ApiProperty({ type: String, example: "Orhan Bey Dönemi" })
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
    example: 0,
    description: "0–3: 1, 3, 7, 21. gün",
  })
  @Expose()
  stage!: number;

  @ApiProperty({ type: String, example: "1. gün" })
  @Expose()
  stageLabel!: string;

  @ApiProperty({ type: String, example: "2026-10-10" })
  @Expose()
  dueOn!: string;

  @ApiProperty({
    type: Boolean,
    description: "Bugün (veya gecikmiş) tekrar edilmeli",
  })
  @Expose()
  isDue!: boolean;

  @ApiProperty({ type: Number, example: 3 })
  @Expose()
  questionCount!: number;
}

/** "Bugünkü tekrar" ekranı. */
export class ReviewSummaryResDto {
  @ApiProperty({ type: String, example: "2026-10-09" })
  @Expose()
  today!: string;

  @ApiProperty({
    type: String,
    enum: ["PLAN", "CONSENT"],
    nullable: true,
    description:
      "Soru üretimi kilitliyse nedeni (`PLAN`: Pro gerekli, `CONSENT`: rıza)",
  })
  @Expose()
  lockedBy!: "PLAN" | "CONSENT" | null;

  @ApiProperty({
    type: Number,
    example: 5,
    description: "Aralıksız tekrar günü",
  })
  @Expose()
  streakDays!: number;

  @ApiProperty({ type: () => [ReviewDayResDto] })
  @Expose()
  @Type(() => ReviewDayResDto)
  week!: ReviewDayResDto[];

  @ApiProperty({ type: Number, example: 6 })
  @Expose()
  dueCount!: number;

  @ApiProperty({
    type: Number,
    example: 840_000,
    description: "Bugünkü tekrarın tahmini süresi",
  })
  @Expose()
  estimatedMs!: number;

  @ApiProperty({
    type: () => [ReviewItemResDto],
    description: "Önce bugünküler, sonra sıradakiler",
  })
  @Expose()
  @Type(() => ReviewItemResDto)
  items!: ReviewItemResDto[];
}

export class ReviewQuestionResDto {
  @ApiProperty({ type: Number, example: 12 })
  @Expose()
  id!: number;

  @ApiProperty({ type: Number, example: 1 })
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

export class ReviewSessionSectionResDto {
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

  @ApiProperty({ type: Number })
  @Expose()
  stage!: number;

  @ApiProperty({ type: String, example: "3. gün" })
  @Expose()
  stageLabel!: string;

  @CdnUrl({
    source: "recapAudioKey",
    optional: true,
    description: "Tekrar özetinin sesi",
  })
  recapAudioUrl!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  recapDurationMs!: number | null;

  @ApiProperty({ type: () => [ReviewQuestionResDto] })
  @Expose()
  @Type(() => ReviewQuestionResDto)
  questions!: ReviewQuestionResDto[];
}

export class ReviewSessionResDto {
  @ApiProperty({
    type: Number,
    example: 5_000,
    description: "Soru başına düşünme süresi",
  })
  @Expose()
  thinkMs!: number;

  @ApiProperty({ type: () => [ReviewSessionSectionResDto] })
  @Expose()
  @Type(() => ReviewSessionSectionResDto)
  sections!: ReviewSessionSectionResDto[];
}

export class ReviewResultResDto {
  @ApiProperty({ type: Number })
  @Expose()
  sectionId!: number;

  @ApiProperty({ type: Number })
  @Expose()
  stage!: number;

  @ApiProperty({ type: String, example: "2026-10-12" })
  @Expose()
  dueOn!: string;

  @ApiProperty({
    type: Boolean,
    description: "Son aşama da bilindi; tekrar bitti",
  })
  @Expose()
  graduated!: boolean;

  @ApiProperty({ type: String, example: "3. gün" })
  @Expose()
  stageLabel!: string;
}
