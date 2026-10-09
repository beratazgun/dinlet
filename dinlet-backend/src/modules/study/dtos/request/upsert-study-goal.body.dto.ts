import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

import { Trim } from "#/core/decorators/index.js";

export class UpsertStudyGoalBodyDto {
  @ApiProperty({ type: String, example: "KPSS", maxLength: 40 })
  @Trim()
  @IsString({ message: "Sınav adı metin olmalıdır" })
  @MinLength(1, { message: "Sınav adı boş olamaz" })
  @MaxLength(40, { message: "Sınav adı en fazla 40 karakter olabilir" })
  examName!: string;

  @ApiProperty({
    type: String,
    example: "2026-11-16",
    description: "Sınav günü (`YYYY-MM-DD`, Türkiye takvimi)",
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Sınav tarihi YYYY-AA-GG biçiminde olmalıdır",
  })
  examDate!: string;
}
