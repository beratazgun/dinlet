import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";
import { ToLowerCase, Trim } from "#/core/decorators/index.js";

export class ResendVerificationBodyDto {
  @ApiProperty({ example: "ahmet.yilmaz@example.com" })
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: "Geçerli bir email adresi giriniz" })
  @IsNotEmpty({ message: "Email adresi zorunludur" })
  email!: string;
}
