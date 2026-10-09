import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";
import { ToLowerCase, Trim } from "#/core/decorators/index.js";

export class ForgotPasswordBodyDto {
  @ApiProperty({ example: "kullanici@example.com" })
  @Trim()
  @ToLowerCase()
  @IsNotEmpty({ message: "E-posta adresi zorunludur." })
  @IsEmail({}, { message: "Geçerli bir e-posta adresi giriniz." })
  email!: string;
}
