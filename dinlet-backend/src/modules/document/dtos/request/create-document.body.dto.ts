import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import { ToUpperCase, Trim } from "#/core/decorators/index.js";
import { RewriteMode } from "#database/enums.js";

const REWRITE_MODES = Object.values(RewriteMode);

export class CreateDocumentBodyDto {
  @ApiProperty({
    type: Number,
    example: 12,
    description: "`POST /media/uploads/:id/complete` ile tamamlanan PDF'in ID'si",
  })
  @IsInt({ message: "Medya ID tam sayı olmalıdır" })
  @Min(1, { message: "Medya ID en az 1 olmalıdır" })
  mediaId!: number;

  @ApiPropertyOptional({
    type: String,
    minLength: 1,
    maxLength: 120,
    example: "Osmanlı Kuruluş Dönemi",
    description: "Verilmezse dosya adından türetilir",
  })
  @IsOptional()
  @Trim()
  @IsString({ message: "Başlık metin olmalıdır" })
  @MinLength(1, { message: "Başlık boş olamaz" })
  @MaxLength(120, { message: "Başlık en fazla 120 karakter olmalıdır" })
  title?: string;

  @ApiPropertyOptional({
    type: String,
    enum: REWRITE_MODES,
    description:
      "Okuma biçimi: `FLUENT` akıcı anlatım (Pro + yurt dışı aktarım rızası), `RAW` düz okuma. Verilmezse planın ve rızanın izin verdiği en iyi biçim seçilir.",
  })
  @IsOptional()
  @Trim()
  @ToUpperCase()
  @IsIn(REWRITE_MODES, { message: "Geçersiz okuma biçimi" })
  rewriteMode?: RewriteMode;
}
