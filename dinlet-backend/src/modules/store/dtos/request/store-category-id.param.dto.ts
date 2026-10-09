import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";

export class StoreCategoryIdParamDto {
  @ApiProperty({ type: Number, example: 1 })
  @ToInt()
  @IsInt({ message: "Kategori ID tam sayı olmalıdır" })
  @Min(1, { message: "Kategori ID en az 1 olmalıdır" })
  id!: number;
}
