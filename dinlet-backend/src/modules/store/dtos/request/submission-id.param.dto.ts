import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";

export class SubmissionIdParamDto {
  @ApiProperty({ type: Number, example: 1 })
  @ToInt()
  @IsInt({ message: "Başvuru ID tam sayı olmalıdır" })
  @Min(1, { message: "Başvuru ID en az 1 olmalıdır" })
  id!: number;
}
