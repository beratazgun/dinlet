import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";

export class StoreItemIdParamDto {
  @ApiProperty({ type: Number, example: 1 })
  @ToInt()
  @IsInt({ message: "İçerik ID tam sayı olmalıdır" })
  @Min(1, { message: "İçerik ID en az 1 olmalıdır" })
  id!: number;
}
