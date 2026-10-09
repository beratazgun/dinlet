import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { IsAccountPassword } from "#/modules/auth/utils/password.validator.js";

export class ResetPasswordBodyDto {
  @ApiProperty({ example: "verification-token" })
  @IsNotEmpty({ message: "Token zorunludur." })
  @IsString({ message: "Token metin olmalıdır." })
  token!: string;

  @ApiProperty({ example: "YeniSifre123", minLength: 8, maxLength: 64 })
  @IsNotEmpty({ message: "Yeni şifre zorunludur." })
  @IsAccountPassword("Yeni şifre")
  newPassword!: string;

  @ApiProperty({ example: "YeniSifre123" })
  @IsNotEmpty({ message: "Şifre tekrarı zorunludur." })
  @IsString({ message: "Şifre tekrarı metin olmalıdır." })
  confirmPassword!: string;
}
