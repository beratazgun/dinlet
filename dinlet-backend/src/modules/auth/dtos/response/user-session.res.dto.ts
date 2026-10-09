import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose } from "class-transformer";
import {
  DateTransformer,
  DateTransformerValueDto,
} from "#/core/decorators/index.js";

/** Kullanıcının açık oturumlarından biri. */
export class UserSessionResDto {
  @ApiProperty({ description: "Oturum id'si", example: "Wu8Yb1kQxG3nZr7pTf" })
  @Expose()
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  userAgent!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  ipAddress!: string | null;

  @ApiPropertyOptional({ type: DateTransformerValueDto, nullable: true })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  createdAt!: DateTransformerValueDto<string> | null;

  @ApiPropertyOptional({ type: DateTransformerValueDto, nullable: true })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  expiresAt!: DateTransformerValueDto<string> | null;

  @ApiProperty({ description: "İsteği yapan oturum mu?" })
  @Expose()
  isCurrent!: boolean;
}
