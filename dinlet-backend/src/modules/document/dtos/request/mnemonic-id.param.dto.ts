import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";

export class MnemonicIdParamDto {
  @ApiProperty({ type: Number, example: 1 })
  @ToInt()
  @IsInt({ message: "Kanca ID tam sayı olmalıdır" })
  @Min(1, { message: "Kanca ID en az 1 olmalıdır" })
  id!: number;
}
