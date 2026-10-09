import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";

export class SectionIdParamDto {
  @ApiProperty({ type: Number, example: 1 })
  @ToInt()
  @IsInt({ message: "Bölüm ID tam sayı olmalıdır" })
  @Min(1, { message: "Bölüm ID en az 1 olmalıdır" })
  id!: number;
}
