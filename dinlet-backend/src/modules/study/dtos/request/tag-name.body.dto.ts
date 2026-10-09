import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

import { Trim } from "#/core/decorators/index.js";

export const TAG_NAME_MAX_LENGTH = 30;

/** Etiket oluşturma ve yeniden adlandırma. */
export class TagNameBodyDto {
  @ApiProperty({
    type: String,
    example: "Zor konular",
    maxLength: TAG_NAME_MAX_LENGTH,
  })
  @Trim()
  @IsString({ message: "Etiket adı metin olmalıdır" })
  @MinLength(1, { message: "Etiket adı boş olamaz" })
  @MaxLength(TAG_NAME_MAX_LENGTH, {
    message: `Etiket adı en fazla ${TAG_NAME_MAX_LENGTH} karakter olabilir`,
  })
  name!: string;
}
