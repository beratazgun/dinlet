import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  DateTransformer,
  DateTransformerValueDto,
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";
import type {
  RewriteMode,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionStore,
} from "#database/enums.js";

export class SubscriptionUsageResDto {
  @ApiProperty({ type: String, example: "2026-10" })
  @Expose()
  periodKey!: string;

  @ApiProperty({ type: Number, example: 12 })
  @Expose()
  usedPages!: number;

  @ApiProperty({ type: Number, example: 18 })
  @Expose()
  remainingPages!: number;

  @ApiProperty({ type: Number, example: 30 })
  @Expose()
  monthlyPages!: number;
}

export class SubscriptionLimitsResDto {
  @ApiProperty({ type: Number, example: 10_485_760, description: "Bayt" })
  @Expose()
  maxFileBytes!: number;

  @ApiProperty({ type: Number, example: 150 })
  @Expose()
  maxPagesPerDocument!: number;

  @Expose()
  @EnumTransformer({ enumType: "RewriteMode" })
  rewriteMode!: EnumTransformerValueDto<RewriteMode>;
}

/** `GET /me/subscription`: etkin plan, dönem ve bu ayki kota. */
export class SubscriptionResDto {
  @Expose()
  @EnumTransformer({ enumType: "SubscriptionPlan" })
  plan!: EnumTransformerValueDto<SubscriptionPlan>;

  @Expose()
  @EnumTransformer({ enumType: "SubscriptionStatus" })
  status!: EnumTransformerValueDto<SubscriptionStatus>;

  @Expose()
  @EnumTransformer({ enumType: "SubscriptionStore" })
  store!: EnumTransformerValueDto<SubscriptionStore>;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  currentPeriodEnd!: DateTransformerValueDto<string>;

  @ApiProperty({ type: () => SubscriptionUsageResDto })
  @Expose()
  @Type(() => SubscriptionUsageResDto)
  usage!: SubscriptionUsageResDto;

  @ApiProperty({ type: () => SubscriptionLimitsResDto })
  @Expose()
  @Type(() => SubscriptionLimitsResDto)
  limits!: SubscriptionLimitsResDto;
}
