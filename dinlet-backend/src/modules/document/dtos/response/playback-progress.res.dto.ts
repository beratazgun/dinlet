import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import {
  DateTransformer,
  DateTransformerValueDto,
} from "#/core/decorators/index.js";

/** Bir bölümdeki dinleme durumu. */
export class PlaybackProgressResDto {
  @ApiProperty({ type: Number, example: 95_000 })
  @Expose()
  positionMs!: number;

  @ApiProperty({ type: Boolean, example: false })
  @Expose()
  completed!: boolean;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  updatedAt!: DateTransformerValueDto<string>;
}
