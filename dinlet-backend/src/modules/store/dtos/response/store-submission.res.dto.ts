import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  DateTransformer,
  DateTransformerValueDto,
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";
import type { SubmissionStatus } from "#database/enums.js";

/** Paylaşım başvurusu ("Paylaştıklarım"). */
export class StoreSubmissionResDto {
  @ApiProperty({ type: Number })
  @Expose()
  id!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Not silindiyse `null`",
  })
  @Expose()
  documentId!: number | null;

  @ApiProperty({ type: String })
  @Expose()
  title!: string;

  @ApiProperty({ type: String })
  @Expose()
  description!: string;

  @ApiProperty({ type: [Number] })
  @Expose()
  categoryIds!: number[];

  @Expose()
  @EnumTransformer({ enumType: "SubmissionStatus" })
  status!: EnumTransformerValueDto<SubmissionStatus>;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Onaylanmadıysa editörün notu",
  })
  @Expose()
  rejectionReason!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Yayındaysa mağaza içeriği",
  })
  @Expose()
  storeItemId!: number | null;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  createdAt!: DateTransformerValueDto<string>;

  @ApiProperty({ type: DateTransformerValueDto, nullable: true })
  @Expose()
  @DateTransformer({
    format: "dd MMMM yyyy HH:mm",
    withRawAndDisplay: true,
    skipNullish: true,
  })
  reviewedAt!: DateTransformerValueDto<string> | null;
}

export class SubmissionAuthorResDto {
  @ApiProperty({ type: Number })
  @Expose()
  id!: number;

  @ApiProperty({ type: String })
  @Expose()
  name!: string;

  @ApiProperty({ type: String })
  @Expose()
  email!: string;
}

/** Editör kuyruğu: başvuran ve notun özeti. */
export class AdminStoreSubmissionResDto extends StoreSubmissionResDto {
  @ApiProperty({ type: () => SubmissionAuthorResDto })
  @Expose()
  @Type(() => SubmissionAuthorResDto)
  author!: SubmissionAuthorResDto;

  @ApiProperty({
    type: Number,
    description: "Notun bölüm sayısı (not silindiyse 0)",
  })
  @Expose()
  sectionCount!: number;
}
