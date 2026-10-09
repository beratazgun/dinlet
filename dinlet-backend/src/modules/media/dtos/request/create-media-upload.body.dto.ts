import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsString, MaxLength, Min, MinLength } from "class-validator";

import { ALLOWED_UPLOAD_MIME_TYPES } from "#/modules/media/utils/index.js";
import { Trim } from "#/core/decorators/index.js";

export class CreateMediaUploadBodyDto {
  @ApiProperty({ type: String, maxLength: 255, example: "profil.jpg" })
  @Trim()
  @IsString({ message: "Dosya adı metin olmalıdır" })
  @MinLength(1, { message: "Dosya adı boş olamaz" })
  @MaxLength(255, { message: "Dosya adı en fazla 255 karakter olmalıdır" })
  fileName!: string;

  @ApiProperty({
    type: String,
    enum: ALLOWED_UPLOAD_MIME_TYPES,
    example: "image/jpeg",
  })
  @IsIn(ALLOWED_UPLOAD_MIME_TYPES, { message: "Bu dosya türü desteklenmiyor" })
  mimeType!: string;

  @ApiProperty({
    type: Number,
    minimum: 1,
    description: "Bayt cinsinden dosya boyutu",
    example: 248_331,
  })
  @IsInt({ message: "Dosya boyutu tam sayı olmalıdır" })
  @Min(1, { message: "Dosya boyutu en az 1 bayt olmalıdır" })
  size!: number;
}
