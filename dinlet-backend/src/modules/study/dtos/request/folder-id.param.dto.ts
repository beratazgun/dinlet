import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";

export class FolderIdParamDto {
  @ApiProperty({ type: Number, example: 1 })
  @ToInt()
  @IsInt({ message: "Klasör ID tam sayı olmalıdır" })
  @Min(1, { message: "Klasör ID en az 1 olmalıdır" })
  id!: number;
}
