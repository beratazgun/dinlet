import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { Trim } from "#/core/decorators/index.js";
import { FOLDER_COLORS } from "#/modules/study/utils/index.js";

export const FOLDER_NAME_MAX_LENGTH = 40;

export class CreateFolderBodyDto {
  @ApiProperty({
    type: String,
    example: "Tarih",
    maxLength: FOLDER_NAME_MAX_LENGTH,
  })
  @Trim()
  @IsString({ message: "Klasör adı metin olmalıdır" })
  @MinLength(1, { message: "Klasör adı boş olamaz" })
  @MaxLength(FOLDER_NAME_MAX_LENGTH, {
    message: `Klasör adı en fazla ${FOLDER_NAME_MAX_LENGTH} karakter olabilir`,
  })
  name!: string;

  @ApiPropertyOptional({
    type: String,
    enum: FOLDER_COLORS,
    description: "Verilmezse paletten sıradaki renk",
  })
  @IsOptional()
  @IsIn(FOLDER_COLORS, { message: "Geçersiz klasör rengi" })
  color?: string;
}
