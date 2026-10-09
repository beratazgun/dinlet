import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsBoolean } from "class-validator";

/**
 * Kayıt formu dışında alınan KVKK onayları (Apple / Google ile açılan
 * hesaplar, metin sürümü değişince yeniden onay). Alanlar kayıt formuyla
 * aynıdır.
 */
export class AcceptConsentsBodyDto {
  @ApiProperty({ type: Boolean, description: "Aydınlatma Metni okundu" })
  @Equals(true, { message: "Aydınlatma Metni'ni okuduğunu onaylamalısın" })
  privacyNoticeAccepted!: boolean;

  @ApiProperty({
    type: Boolean,
    description: "Kullanım Koşulları ve içerik hakları beyanı",
  })
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
