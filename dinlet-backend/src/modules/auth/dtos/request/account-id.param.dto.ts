import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";
import { ToInt } from "#/core/decorators/index.js";

export class AccountIdParamDto {
  @ApiProperty({ type: Number, example: 1 })
  @ToInt()
  @IsInt({ message: "Hesap ID tam sayı olmalıdır" })
  @Min(1, { message: "Hesap ID en az 1 olmalıdır" })
  accountId!: number;
}
