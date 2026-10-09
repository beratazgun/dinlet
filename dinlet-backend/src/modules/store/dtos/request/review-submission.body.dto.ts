import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { Trim } from "#/core/decorators/index.js";

/** Onay: editör başlık, açıklama ve kategorileri düzeltebilir. */
export class ApproveSubmissionBodyDto {
  @ApiPropertyOptional({ type: String })
  @Trim()
  @IsOptional()
  @IsString({ message: "Başlık metin olmalıdır" })
  @MinLength(4, { message: "Başlık en az 4 karakter olmalıdır" })
  @MaxLength(120, { message: "Başlık en fazla 120 karakter olabilir" })
  title?: string;

  @ApiPropertyOptional({ type: String })
  @Trim()
  @IsOptional()
  @IsString({ message: "Açıklama metin olmalıdır" })
  @MinLength(10, { message: "Açıklama en az 10 karakter olmalıdır" })
  @MaxLength(2_000, { message: "Açıklama en fazla 2000 karakter olabilir" })
  description?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray({ message: "Kategoriler dizi olmalıdır" })
  @ArrayMinSize(1, { message: "En az bir kategori seç" })
  @ArrayMaxSize(10, { message: "En fazla 10 kategori seçilebilir" })
  @IsInt({ each: true, message: "Kategori ID tam sayı olmalıdır" })
  categoryIds?: number[];
}

export class RejectSubmissionBodyDto {
  @ApiProperty({
    type: String,
    example: "Not bir yayınevinin kitabından alınmış görünüyor.",
    description: "Kullanıcıya gösterilir",
  })
  @Trim()
  @IsString({ message: "Neden metin olmalıdır" })
  @MinLength(5, { message: "Neden en az 5 karakter olmalıdır" })
  @MaxLength(400, { message: "Neden en fazla 400 karakter olabilir" })
  reason!: string;
}
