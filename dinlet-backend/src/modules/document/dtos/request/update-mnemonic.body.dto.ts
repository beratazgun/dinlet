import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

/** Hafıza kancasını sakla / kaldır. */
export class UpdateMnemonicBodyDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: "Sakla (bölüm sonunda okunur)",
  })
  @IsOptional()
  @IsBoolean({ message: "Saklama bilgisi true/false olmalıdır" })
  kept?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: "Kaldır (listeden gizlenir)",
  })
  @IsOptional()
  @IsBoolean({ message: "Kaldırma bilgisi true/false olmalıdır" })
  dismissed?: boolean;
}
