import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

import { Trim } from "#/core/decorators/index.js";

/** Not düzenleme: başlık, klasör ve favori; verilmeyen alan değişmez. */
export class UpdateDocumentBodyDto {
  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 120 })
  @IsOptional()
  @Trim()
  @IsString({ message: "Başlık metin olmalıdır" })
  @MinLength(1, { message: "Başlık boş olamaz" })
  @MaxLength(120, { message: "Başlık en fazla 120 karakter olmalıdır" })
  title?: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: "Taşınacak klasör; `null` klasörden çıkarır",
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: "Klasör ID tam sayı olmalıdır" })
  @Min(1, { message: "Klasör ID en az 1 olmalıdır" })
  folderId?: number | null;

  @ApiPropertyOptional({ type: Boolean, description: "★ Favori" })
  @IsOptional()
  @IsBoolean({ message: "Favori bilgisi true/false olmalıdır" })
  isFavorite?: boolean;
}
