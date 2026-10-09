import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";
import { MAX_CLIP_MS, MIN_CLIP_MS } from "#/modules/recording/utils/index.js";

export class SaveClipQueryDto {
  @ApiProperty({
    type: Number,
    example: 47_000,
    description: "Kaydın süresi (ms)",
  })
  @ToInt()
  @IsInt({ message: "Süre tam sayı olmalıdır" })
  @Min(MIN_CLIP_MS, { message: "Kayıt çok kısa" })
  @Max(MAX_CLIP_MS, { message: "Bir paragraf en fazla 10 dakika olabilir" })
  durationMs!: number;
}
