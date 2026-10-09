import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";

export class ReviewSectionIdParamDto {
  @ApiProperty({ type: Number, example: 3 })
  @ToInt()
  @IsInt({ message: "Bölüm ID tam sayı olmalıdır" })
  @Min(1, { message: "Bölüm ID en az 1 olmalıdır" })
  sectionId!: number;
}
