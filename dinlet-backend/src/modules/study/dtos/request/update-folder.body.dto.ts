import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { Trim } from "#/core/decorators/index.js";
import { FOLDER_COLORS } from "#/modules/study/utils/index.js";

import { FOLDER_NAME_MAX_LENGTH } from "./create-folder.body.dto.js";

export class UpdateFolderBodyDto {
  @ApiPropertyOptional({ type: String, maxLength: FOLDER_NAME_MAX_LENGTH })
  @IsOptional()
  @Trim()
  @IsString({ message: "Klasör adı metin olmalıdır" })
  @MinLength(1, { message: "Klasör adı boş olamaz" })
  @MaxLength(FOLDER_NAME_MAX_LENGTH, {
    message: `Klasör adı en fazla ${FOLDER_NAME_MAX_LENGTH} karakter olabilir`,
  })
  name?: string;

  @ApiPropertyOptional({ type: String, enum: FOLDER_COLORS })
  @IsOptional()
  @IsIn(FOLDER_COLORS, { message: "Geçersiz klasör rengi" })
  color?: string;
}
