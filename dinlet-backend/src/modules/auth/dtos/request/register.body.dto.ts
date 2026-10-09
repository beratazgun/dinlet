import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { ToLowerCase, Trim } from "#/core/decorators/index.js";
import { IsAccountPassword } from "#/modules/auth/utils/password.validator.js";

/**
 * Mobil kayıt formu: ad, e-posta, şifre ve KVKK onayları. Kullanıcı adı
 * istenmez, e-postadan üretilir. Aydınlatma metni ve kullanım koşulları
 * zorunlu; yurt dışına aktarım rızası isteğe bağlıdır (açık rıza hizmetin
 * ön şartı yapılamaz) — verilmezse notlar LLM'siz işlenir.
 */
export class RegisterBodyDto {
  @ApiProperty({ example: "Elif", minLength: 2, maxLength: 50 })
  @Trim()
  @IsString({ message: "Ad metin olmalıdır" })
  @IsNotEmpty({ message: "Ad zorunludur" })
  @MinLength(2, { message: "Ad en az 2 karakter olmalıdır" })
  @MaxLength(50, { message: "Ad en fazla 50 karakter olmalıdır" })
  name!: string;

  @ApiPropertyOptional({ type: String, example: "Yılmaz", maxLength: 50 })
  @IsOptional()
  @Trim()
  @IsString({ message: "Soyad metin olmalıdır" })
  @MaxLength(50, { message: "Soyad en fazla 50 karakter olmalıdır" })
  surname?: string;

  @ApiProperty({ example: "elif@ornek.com" })
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: "Geçerli bir e-posta adresi giriniz" })
  @IsNotEmpty({ message: "E-posta adresi zorunludur" })
  email!: string;

  @ApiProperty({ example: "GuvenliSifre123", minLength: 8, maxLength: 64 })
  @IsAccountPassword()
  password!: string;

  @ApiProperty({ type: Boolean, description: "Aydınlatma Metni okundu" })
  @Equals(true, { message: "Aydınlatma Metni'ni okuduğunu onaylamalısın" })
  privacyNoticeAccepted!: boolean;

  @ApiProperty({ type: Boolean, description: "Kullanım Koşulları ve içerik hakları beyanı" })
  @Equals(true, { message: "Kullanım Koşulları'nı kabul etmelisin" })
  termsAccepted!: boolean;

  @ApiProperty({
    type: Boolean,
    description:
      "Notların anlatıma çevrilmek için yurt dışındaki yapay zekâ servisine aktarılmasına açık rıza",
  })
  @IsBoolean({ message: "Rıza bilgisi true/false olmalıdır" })
  crossBorderTransferConsent!: boolean;
}
