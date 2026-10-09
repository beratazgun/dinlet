import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class CoverageKindResDto {
  @ApiProperty({ type: Number, example: 18 })
  @Expose()
  total!: number;

  @ApiProperty({ type: Number, example: 18 })
  @Expose()
  covered!: number;
}

export class CoverageKindsResDto {
  @ApiProperty({ type: () => CoverageKindResDto, description: "Tarihler" })
  @Expose()
  @Type(() => CoverageKindResDto)
  date!: CoverageKindResDto;

  @ApiProperty({ type: () => CoverageKindResDto, description: "Sayılar" })
  @Expose()
  @Type(() => CoverageKindResDto)
  number!: CoverageKindResDto;

  @ApiProperty({ type: () => CoverageKindResDto, description: "Özel isimler" })
  @Expose()
  @Type(() => CoverageKindResDto)
  name!: CoverageKindResDto;
}

export class CoverageMissingResDto {
  @ApiProperty({ type: Number })
  @Expose()
  sectionId!: number;

  @ApiProperty({ type: Number, example: 3 })
  @Expose()
  sectionOrder!: number;

  @ApiProperty({ type: String })
  @Expose()
  sectionTitle!: string;

  @ApiProperty({ type: Number, nullable: true, example: 14 })
  @Expose()
  pageStart!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  pageEnd!: number | null;

  @ApiProperty({ type: String, enum: ["date", "number", "name"] })
  @Expose()
  kind!: "date" | "number" | "name";

  @ApiProperty({ type: String, example: "Alaeddin Paşa" })
  @Expose()
  term!: string;

  @ApiProperty({ type: String, example: "İlk vezir: Alaeddin Paşa" })
  @Expose()
  snippet!: string;
}

/** Kapsam güvencesi: "Notundaki 64 bilginin 62'si anlatımda geçiyor". */
export class CoverageResDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: 100, example: 97 })
  @Expose()
  percent!: number;

  @ApiProperty({ type: Number, example: 64 })
  @Expose()
  total!: number;

  @ApiProperty({ type: Number, example: 62 })
  @Expose()
  covered!: number;

  @ApiProperty({ type: () => CoverageKindsResDto })
  @Expose()
  @Type(() => CoverageKindsResDto)
  kinds!: CoverageKindsResDto;

  @ApiProperty({
    type: () => [CoverageMissingResDto],
    description: "En fazla 50",
  })
  @Expose()
  @Type(() => CoverageMissingResDto)
  missing!: CoverageMissingResDto[];

  @ApiProperty({ type: Number, example: 2 })
  @Expose()
  missingCount!: number;

  @ApiProperty({
    type: Boolean,
    description: "Bölüm yeniden üretilebilir mi (akıcı anlatım + Pro + rıza)",
  })
  @Expose()
  canRegenerate!: boolean;
}

export class RegenerateSectionResDto {
  @ApiProperty({ type: Number })
  @Expose()
  sectionId!: number;
}
