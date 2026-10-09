import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

import { VoicePreference } from "#database/enums.js";

const VOICES = Object.values(VoicePreference);

export class UpdateVoiceBodyDto {
  @ApiProperty({ type: String, enum: VOICES })
  @IsIn(VOICES, { message: "Geçersiz ses" })
  voice!: VoicePreference;
}
