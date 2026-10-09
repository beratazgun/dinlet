import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IsAccountPassword } from "#/modules/auth/utils/password.validator.js";

export class ChangePasswordBodyDto {
  @ApiPropertyOptional({ example: "EskiSifre123!" })
  @IsOptional()
  @IsString({ message: "Mevcut şifre metin olmalıdır." })
  currentPassword?: string;

  @ApiProperty({ example: "YeniSifre123", minLength: 8, maxLength: 64 })
  @IsNotEmpty({ message: "Yeni şifre zorunludur." })
  @IsAccountPassword("Yeni şifre")
  newPassword!: string;

  @ApiProperty({ example: "YeniSifre123" })
  @IsNotEmpty({ message: "Şifre tekrarı zorunludur." })
  @IsString({ message: "Şifre tekrarı metin olmalıdır." })
  confirmPassword!: string;
}
