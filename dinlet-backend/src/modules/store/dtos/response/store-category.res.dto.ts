import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class StoreCategoryResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  id!: number;

  @ApiProperty({ type: String, example: "kpss" })
  @Expose()
  slug!: string;

  @ApiProperty({ type: String, example: "KPSS" })
  @Expose()
  name!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Dersin sınavı; sınavda `null`",
  })
  @Expose()
  parentId!: number | null;

  @ApiProperty({ type: Number, example: 0 })
  @Expose()
  position!: number;
}

/** Sınav ve altındaki dersler (mağaza çipleri ve ders sekmeleri). */
export class StoreCategoryTreeResDto extends StoreCategoryResDto {
  @ApiProperty({ type: () => [StoreCategoryResDto] })
  @Expose()
  @Type(() => StoreCategoryResDto)
  children!: StoreCategoryResDto[];
}
