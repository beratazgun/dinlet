import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength } from "class-validator";

/**
 * E-postadaki bağlantının (onay, şifre sıfırlama) taşıdığı tek kullanımlık
 * token; uygulamanın derin bağlantısına aktarılır.
 */
export class AppLinkTokenQueryDto {
  @ApiProperty({ type: String, example: "x8Kp…" })
  @IsString({ message: "Token metin olmalıdır" })
  @MaxLength(128, { message: "Token geçersiz" })
  @Matches(/^[\w-]+$/, { message: "Token geçersiz" })
  token!: string;
}
