import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from "class-validator";

export const MAX_TAGS_PER_DOCUMENT = 10;

export class SetDocumentTagsBodyDto {
  @ApiProperty({
    type: [Number],
    example: [2, 5],
    description: "Notun etiketleri; liste mevcut etiketlerin yerine geçer",
  })
  @IsArray({ message: "Etiketler liste olmalıdır" })
  @ArrayUnique({ message: "Aynı etiket iki kez verilemez" })
  @ArrayMaxSize(MAX_TAGS_PER_DOCUMENT, {
    message: `Bir notta en fazla ${MAX_TAGS_PER_DOCUMENT} etiket olabilir`,
  })
  @IsInt({ each: true, message: "Etiket ID tam sayı olmalıdır" })
  @Min(1, { each: true, message: "Etiket ID en az 1 olmalıdır" })
  tagIds!: number[];
}
