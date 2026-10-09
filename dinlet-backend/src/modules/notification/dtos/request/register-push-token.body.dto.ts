import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, Matches, MaxLength } from "class-validator";

import { ToUpperCase, Trim } from "#/core/decorators/index.js";
import { DevicePlatform } from "#database/enums.js";

const PLATFORMS = Object.values(DevicePlatform);

export class RegisterPushTokenBodyDto {
  @ApiProperty({
    type: String,
    example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  })
  @Trim()
  @IsString({ message: "Push token metin olmalıdır" })
  @MaxLength(255, { message: "Push token çok uzun" })
  @Matches(/^Expo(nent)?PushToken\[[^\]]+\]$/, {
    message: "Geçerli bir Expo push token'ı giriniz",
  })
  token!: string;

  @ApiProperty({ type: String, enum: PLATFORMS })
  @ToUpperCase()
  @IsIn(PLATFORMS, { message: "Platform IOS veya ANDROID olmalıdır" })
  platform!: DevicePlatform;
}
