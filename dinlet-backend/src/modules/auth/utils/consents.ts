import { ConsentType } from "#database/enums.js";

/**
 * Yürürlükteki metin sürümleri. Aydınlatma metni veya kullanım koşulları
 * değişince sürüm artırılır; kayıtlı onaylar hangi sürümün kabul edildiğini
 * kanıtlar ve eski sürümü kabul etmiş kullanıcıdan yeniden onay istenebilir.
 */
export const CONSENT_VERSIONS: Record<ConsentType, string> = {
  [ConsentType.PRIVACY_NOTICE]: "2026-10-01",
  [ConsentType.TERMS_OF_USE]: "2026-10-01",
  [ConsentType.CROSS_BORDER_TRANSFER]: "2026-10-01",
};

/** Hesap açmak için kabul edilmesi zorunlu metinler. */
export const REQUIRED_CONSENTS: ConsentType[] = [
  ConsentType.PRIVACY_NOTICE,
  ConsentType.TERMS_OF_USE,
];
