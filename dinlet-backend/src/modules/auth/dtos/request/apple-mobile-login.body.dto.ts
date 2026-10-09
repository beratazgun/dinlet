import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

import { Trim } from "#/core/decorators/index.js";

export class AppleMobileLoginBodyDto {
  @ApiProperty({
    type: String,
    description: "Sign in with Apple'dan dönen `identityToken`",
  })
  @IsString({ message: "identityToken metin olmalıdır" })
  @IsNotEmpty({ message: "identityToken zorunludur" })
  @MaxLength(4096, { message: "identityToken çok uzun" })
  identityToken!: string;

  @ApiProperty({
    type: String,
    description: "İstemcinin girişte ürettiği ham nonce",
  })
  @IsString({ message: "nonce metin olmalıdır" })
  @IsNotEmpty({ message: "nonce zorunludur" })
  @MaxLength(256, { message: "nonce çok uzun" })
  nonce!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Apple ad bilgisini yalnızca ilk girişte istemciye verir",
  })
  @IsOptional()
  @Trim()
  @IsString({ message: "Ad metin olmalıdır" })
  @MaxLength(50, { message: "Ad en fazla 50 karakter olmalıdır" })
  name?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Trim()
  @IsString({ message: "Soyad metin olmalıdır" })
  @MaxLength(50, { message: "Soyad en fazla 50 karakter olmalıdır" })
  surname?: string | null;
}
