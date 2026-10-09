import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import type { NotificationType } from "#database/enums.js";
import {
  DateTransformer,
  DateTransformerValueDto,
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";

/**
 * Bildirim. HTTP listesinde ve WebSocket `notification` olayında aynı
 * biçimde döner.
 */
export class NotificationResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  id!: number;

  @Expose()
  @EnumTransformer({ enumType: "NotificationType" })
  type!: EnumTransformerValueDto<NotificationType>;

  @ApiProperty({ type: String, nullable: true, example: "Şifreniz değiştirildi" })
  @Expose()
  title!: string | null;

  @ApiProperty({ type: String })
  @Expose()
  message!: string;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  actorId!: number | null;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  entityType!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  entityId!: number | null;

  @ApiProperty({ type: Boolean, example: false })
  @Expose()
  isRead!: boolean;

  @ApiProperty({ type: DateTransformerValueDto, nullable: true })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  readAt!: DateTransformerValueDto<string> | null;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  createdAt!: DateTransformerValueDto<string>;
}
