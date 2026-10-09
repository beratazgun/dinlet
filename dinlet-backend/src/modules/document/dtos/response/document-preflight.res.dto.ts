import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  DateTransformer,
  DateTransformerValueDto,
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";
import type { SubscriptionPlan } from "#database/enums.js";

export const FLUENT_BLOCK_REASONS = ["PLAN", "CONSENT"] as const;
export type FluentBlockReason = (typeof FLUENT_BLOCK_REASONS)[number];

export class PreflightQuotaResDto {
  @ApiProperty({ type: Number, example: 500 })
  @Expose()
  monthlyPages!: number;

  @ApiProperty({ type: Number, example: 214 })
  @Expose()
  usedPages!: number;

  @ApiProperty({ type: Number, example: 286 })
  @Expose()
  remainingPages!: number;

  @ApiProperty({ type: Boolean, description: "Bu PDF kalan hakka sığıyor mu" })
  @Expose()
  enough!: boolean;

  @ApiProperty({
    type: DateTransformerValueDto,
    description: "Hakkın yenileneceği an",
  })
  @Expose()
  @DateTransformer({ format: "d MMMM", withRawAndDisplay: true })
  resetsAt!: DateTransformerValueDto<string>;
}

export class PreflightFluentResDto {
  @ApiProperty({
    type: Boolean,
    description: "Akıcı anlatım bu not için seçilebilir mi",
  })
  @Expose()
  available!: boolean;

  @ApiProperty({
    type: String,
    enum: FLUENT_BLOCK_REASONS,
    nullable: true,
    description:
      "`PLAN`: Pro gerekli · `CONSENT`: yurt dışına aktarım rızası gerekli",
  })
  @Expose()
  blockedBy!: FluentBlockReason | null;
}

/**
 * Yüklenen PDF'in ön kontrolü (`POST /documents/preflight`): sayfa sayısı,
 * kotaya etkisi ve okuma biçimi seçenekleri. Kota düşülmez.
 */
export class DocumentPreflightResDto {
  @ApiProperty({ type: Number, example: 12 })
  @Expose()
  mediaId!: number;

  @ApiProperty({ type: String, example: "osmanli-kurulus-notlari.pdf" })
  @Expose()
  fileName!: string;

  @ApiProperty({ type: Number, description: "Bayt", example: 6_500_000 })
  @Expose()
  size!: number;

  @ApiProperty({ type: Number, example: 48 })
  @Expose()
  pageCount!: number;

  @ApiProperty({
    type: String,
    example: "osmanli kurulus notlari",
    description: "Dosya adından önerilen başlık",
  })
  @Expose()
  suggestedTitle!: string;

  @Expose()
  @EnumTransformer({ enumType: "SubscriptionPlan" })
  plan!: EnumTransformerValueDto<SubscriptionPlan>;

  @ApiProperty({ type: () => PreflightQuotaResDto })
  @Expose()
  @Type(() => PreflightQuotaResDto)
  quota!: PreflightQuotaResDto;

  @ApiProperty({
    type: Number,
    example: 500,
    description: "Pro planın aylık sayfa hakkı",
  })
  @Expose()
  proMonthlyPages!: number;

  @ApiProperty({ type: () => PreflightFluentResDto })
  @Expose()
  @Type(() => PreflightFluentResDto)
  fluent!: PreflightFluentResDto;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "Aynı PDF daha önce yüklendiyse o notun ID'si (yeniden kota düşülmez)",
  })
  @Expose()
  existingDocumentId!: number | null;
}
