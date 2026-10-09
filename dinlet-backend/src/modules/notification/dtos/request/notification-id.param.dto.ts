import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";

export class NotificationIdParamDto {
  @ApiProperty({ type: Number, example: 1 })
  @ToInt()
  @IsInt({ message: "Bildirim ID tam sayı olmalıdır" })
  @Min(1, { message: "Bildirim ID en az 1 olmalıdır" })
  id!: number;
}
