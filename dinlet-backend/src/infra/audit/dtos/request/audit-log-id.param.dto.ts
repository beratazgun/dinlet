import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";

export class AuditLogIdParamDto {
  @ApiProperty({ type: Number, example: 1 })
  @ToInt()
  @IsInt({ message: "Kayıt ID tam sayı olmalıdır" })
  @Min(1, { message: "Kayıt ID en az 1 olmalıdır" })
  id!: number;
}
