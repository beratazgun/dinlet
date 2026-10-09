import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class PushTokenParamDto {
  @ApiProperty({
    type: String,
    description: "URL-encode edilmiş Expo push token'ı",
  })
  @IsString({ message: "Push token metin olmalıdır" })
  @MaxLength(255, { message: "Push token çok uzun" })
  token!: string;
}
