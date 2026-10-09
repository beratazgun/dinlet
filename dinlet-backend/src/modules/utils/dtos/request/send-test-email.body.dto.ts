import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class SendTestEmailBodyDto {
  @ApiProperty({
    description: "Gönderilecek şablon kodu",
    example: "WELCOME",
    enum: [
      "OPS_ALERT",
      "VERIFICATION_EMAIL",
      "WELCOME",
      "PASSWORD_RESET_EMAIL",
      "PASSWORD_CHANGED",
      "ACCOUNT_DELETION_EMAIL",
      "ACCOUNT_LOCKED",
      "NEW_DEVICE_LOGIN",
      "EMAIL_UPDATED_VERIFICATION",
    ],
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({
    description:
      "Hedef e-posta adresi (boş bırakılırsa yapılandırılmış geliştirici/uyarı e-postası kullanılır)",
    example: "test@example.com",
  })
  @IsEmail()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    description:
      "Şablona aktarılacak özel değişkenler (boşsa varsayılan örnek değişkenler kullanılır)",
    example: { name: "Ahmet", surname: "Yılmaz" },
  })
  @IsObject()
  @IsOptional()
  variables?: Record<string, unknown>;
}
