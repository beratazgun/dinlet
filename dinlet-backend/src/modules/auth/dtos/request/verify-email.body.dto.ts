import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class VerifyEmailBodyDto {
  @ApiProperty({ example: "verification-token" })
  @IsString({ message: "Token metin olmalıdır" })
  @MinLength(1, { message: "Token zorunludur" })
  token!: string;
}
