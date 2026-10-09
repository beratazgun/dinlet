import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from "class-validator";

export class TerminateSessionsBodyDto {
  @ApiProperty({
    type: [String],
    description: "Sonlandırılacak oturum id'leri",
    example: ["Wu8Yb1kQxG3nZr7pTfLhVmSd"],
  })
  @IsArray({ message: "Oturum ID listesi dizi olmalıdır" })
  @ArrayMinSize(1, { message: "En az bir oturum ID gereklidir" })
  @IsString({ each: true, message: "Her oturum ID metin olmalıdır" })
  @IsNotEmpty({ each: true, message: "Oturum ID boş olamaz" })
  sessionIds!: string[];
}
