import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class DocumentProgressResDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: 100, example: 42 })
  @Expose()
  percent!: number;

  @ApiProperty({ type: [Number], description: "Sesi hazır bölümler" })
  @Expose()
  readySectionIds!: number[];
}
