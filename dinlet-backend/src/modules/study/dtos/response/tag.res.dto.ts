import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class TagResDto {
  @ApiProperty({ type: Number, example: 2 })
  @Expose()
  id!: number;

  @ApiProperty({ type: String, example: "Zor konular" })
  @Expose()
  name!: string;

  @ApiProperty({ type: Number, example: 3 })
  @Expose()
  documentCount!: number;
}

/** Nota bağlı etiket (sayısız). */
export class DocumentTagResDto {
  @ApiProperty({ type: Number, example: 2 })
  @Expose()
  id!: number;

  @ApiProperty({ type: String, example: "Zor konular" })
  @Expose()
  name!: string;
}
