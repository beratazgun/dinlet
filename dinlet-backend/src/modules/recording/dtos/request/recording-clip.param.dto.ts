import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";

import { RecordingSectionParamDto } from "./recording-section.param.dto.js";

export class RecordingClipParamDto extends RecordingSectionParamDto {
  @ApiProperty({
    type: Number,
    example: 0,
    description: "Paragraf sırası (0'dan); tekrar özeti en sonda",
  })
  @ToInt()
  @IsInt({ message: "Paragraf sırası tam sayı olmalıdır" })
  @Min(0, { message: "Paragraf sırası negatif olamaz" })
  @Max(500, { message: "Geçersiz paragraf sırası" })
  position!: number;
}
