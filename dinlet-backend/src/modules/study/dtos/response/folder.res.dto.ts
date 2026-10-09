import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

/** Klasör kartı: "Tarih · 4 belge · 3 bitti". */
export class FolderResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  id!: number;

  @ApiProperty({ type: String, example: "Tarih" })
  @Expose()
  name!: string;

  @ApiProperty({ type: String, example: "#1928B4" })
  @Expose()
  color!: string;

  @ApiProperty({ type: Number, example: 4 })
  @Expose()
  documentCount!: number;

  @ApiProperty({
    type: Number,
    example: 3,
    description: "Tamamen dinlenen not",
  })
  @Expose()
  finishedCount!: number;

  @ApiProperty({ type: Number, minimum: 0, maximum: 100, example: 75 })
  @Expose()
  progressPercent!: number;
}
