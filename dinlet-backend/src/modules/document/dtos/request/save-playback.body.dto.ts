import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, Max, Min } from "class-validator";

const DAY_MS = 24 * 60 * 60 * 1_000;

export class SavePlaybackBodyDto {
  @ApiProperty({ type: Number, minimum: 0, example: 95_000, description: "Kaldığı yer (ms)" })
  @IsInt({ message: "Konum tam sayı (ms) olmalıdır" })
  @Min(0, { message: "Konum negatif olamaz" })
  @Max(DAY_MS, { message: "Konum geçersiz" })
  positionMs!: number;

  @ApiProperty({ type: Boolean, example: false })
  @IsBoolean({ message: "Tamamlandı bilgisi true/false olmalıdır" })
  completed!: boolean;
}
