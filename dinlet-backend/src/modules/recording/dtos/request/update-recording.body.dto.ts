import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateRecordingBodyDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: "Bu bölümde kendi sesin mi çalsın (`false`: Dinlet sesi)",
  })
  @IsOptional()
  @IsBoolean({ message: "Ses seçimi true/false olmalıdır" })
  useOwnVoice?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: '"Kaydet": tüm paragraflar kayıtlıysa tek sese birleştirilir',
  })
  @IsOptional()
  @IsBoolean({ message: "Kaydet true/false olmalıdır" })
  finalize?: boolean;
}
