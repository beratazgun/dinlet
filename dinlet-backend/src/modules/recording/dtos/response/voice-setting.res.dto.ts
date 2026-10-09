import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";
import type { VoicePreference } from "#database/enums.js";

export class VoiceOptionResDto {
  @Expose()
  @EnumTransformer({ enumType: "VoicePreference" })
  voice!: EnumTransformerValueDto<VoicePreference>;

  @ApiProperty({
    type: Boolean,
    description: "Seçilebilir (Doğal ses henüz yok)",
  })
  @Expose()
  available!: boolean;

  @ApiProperty({ type: Boolean })
  @Expose()
  requiresPro!: boolean;

  @ApiProperty({ type: String })
  @Expose()
  description!: string;
}

/** Ses seçimi ekranı. */
export class VoiceSettingResDto {
  @Expose()
  @EnumTransformer({ enumType: "VoicePreference" })
  voice!: EnumTransformerValueDto<VoicePreference>;

  @ApiProperty({ type: () => [VoiceOptionResDto] })
  @Expose()
  @Type(() => VoiceOptionResDto)
  options!: VoiceOptionResDto[];

  @ApiProperty({
    type: Number,
    description: "Kayıtlarım sayısı (hazır + yarım)",
  })
  @Expose()
  recordingCount!: number;
}
