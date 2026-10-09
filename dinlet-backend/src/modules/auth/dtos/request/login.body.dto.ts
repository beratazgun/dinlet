import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { ToLowerCase, Trim } from "#/core/decorators/index.js";

export class LoginBodyDto {
  @ApiProperty({ example: "user@example.com" })
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: "Geçerli bir email adresi giriniz" })
  @IsNotEmpty({ message: "Email adresi zorunludur" })
  email!: string;

  @ApiProperty({ example: "Test123!" })
  @IsString({ message: "Şifre metin olmalıdır" })
  @IsNotEmpty({ message: "Şifre zorunludur" })
  password!: string;
}
