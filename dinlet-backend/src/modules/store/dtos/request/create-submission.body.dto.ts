import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import { Trim } from "#/core/decorators/index.js";

/**
 * "Mağazada paylaş": kullanıcının kendi hazır notu. Editör onaylayınca
 * herkese ücretsiz açılır.
 */
export class CreateSubmissionBodyDto {
  @ApiProperty({ type: Number, description: "Paylaşılacak not (senin, hazır)" })
  @IsInt({ message: "Not ID tam sayı olmalıdır" })
  @Min(1, { message: "Not ID en az 1 olmalıdır" })
  documentId!: number;

  @ApiProperty({ type: String, example: "Osmanlı Kuruluş Dönemi özetim" })
  @Trim()
  @IsString({ message: "Başlık metin olmalıdır" })
  @MinLength(4, { message: "Başlık en az 4 karakter olmalıdır" })
  @MaxLength(100, { message: "Başlık en fazla 100 karakter olabilir" })
  title!: string;

  @ApiProperty({ type: String, description: "Notta ne var, kime faydalı" })
  @Trim()
  @IsString({ message: "Açıklama metin olmalıdır" })
  @MinLength(20, { message: "Açıklama en az 20 karakter olmalıdır" })
  @MaxLength(600, { message: "Açıklama en fazla 600 karakter olabilir" })
  description!: string;

  @ApiProperty({ type: [Number], description: "Sınav ve ders (en az biri)" })
  @IsArray({ message: "Kategoriler dizi olmalıdır" })
  @ArrayMinSize(1, { message: "En az bir sınav veya ders seç" })
  @ArrayMaxSize(4, { message: "En fazla 4 kategori seçilebilir" })
  @IsInt({ each: true, message: "Kategori ID tam sayı olmalıdır" })
  categoryIds!: number[];

  @ApiProperty({
    type: Boolean,
    description:
      "Notun içeriğinin bana ait olduğunu (başkasının kitabı/ders notu değil) ve herkesin dinleyebilmesine rıza verdiğimi onaylıyorum.",
  })
  @Equals(true, {
    message: "Paylaşmak için içeriğin sana ait olduğunu onaylamalısın",
  })
  confirmRights!: boolean;
}
