import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  ValidateNested,
} from "class-validator";

export class ReviewAnswerDto {
  @ApiProperty({ type: Number, example: 12 })
  @IsInt({ message: "Soru ID tam sayı olmalıdır" })
  @Min(1, { message: "Soru ID en az 1 olmalıdır" })
  questionId!: number;

  @ApiProperty({
    type: Boolean,
    description: "Bildim (`true`) / Bilemedim (`false`)",
  })
  @IsBoolean({ message: "Cevap true/false olmalıdır" })
  known!: boolean;
}

export class SubmitReviewBodyDto {
  @ApiProperty({ type: () => [ReviewAnswerDto] })
  @IsArray({ message: "Cevaplar liste olmalıdır" })
  @ArrayMinSize(1, { message: "En az bir cevap gönderilmeli" })
  @ArrayMaxSize(10, { message: "En fazla 10 cevap gönderilebilir" })
  @ValidateNested({ each: true })
  @Type(() => ReviewAnswerDto)
  answers!: ReviewAnswerDto[];
}
