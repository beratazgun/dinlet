import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";

export class DocumentIdParamDto {
  @ApiProperty({ type: Number, example: 1 })
  @ToInt()
  @IsInt({ message: "Belge ID tam sayı olmalıdır" })
  @Min(1, { message: "Belge ID en az 1 olmalıdır" })
  id!: number;
}
