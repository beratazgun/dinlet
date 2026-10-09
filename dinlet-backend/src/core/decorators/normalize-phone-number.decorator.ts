import { Transform } from 'class-transformer';

type PhoneFormatTypes =
  '(***) *** ** **' | '(0***) *** ** **' | '*** *** ** **' | '**********';

export interface NormalizePhoneNumberOptions {
  /**
   * Null/undefined değerleri atla
   */
  skipNullish?: boolean;
  /**
   * Hata durumunda varsayılan değer
   */
  defaultValue?: string;
  /**
   * Telefon numarası formatı. '*' karakterleri rakamlar ile değiştirilir.
   * Örnek: "(***) *** ** **", "(0***) *** ** **", "*** *** ** **", "**********"
   * Eğer belirtilmezse varsayılan Türkiye formatı (XXXXXXXXXXX) döner.
   */
  format?: PhoneFormatTypes;
}

/**
 * Türkiye telefon numaralarını normalize eder ve isteğe bağlı olarak formatlar.
 *
 * İşlevler:
 * - Tüm rakam olmayan karakterleri kaldırır
 * - +90 ile başlıyorsa 90'ı kaldırır
 * - 0 ile başlıyorsa başındaki 0'ı kaldırır
 * - Kalan 10 haneyi (5XXXXXXXXX) isteğe bağlı format ile düzenler
 * - Format belirtilmezse başı 0'lı 11 hane döner
 *
 * @example
 * // Kullanım örneği
 * class RegisterDto {
 *   @NormalizePhoneNumber({ format: '(***) *** ** **' })
 *   phoneNumber: string;
 * }
 *
 * // Örnekler:
 * // format: undefined (varsayılan)
 * // "5321234567" -> "05321234567"
 *
 * // format: "(***) *** ** **"
 * // "0532 123 45 67" -> "(532) 123 45 67"
 *
 * // format: "(0***) *** ** **"
 * // "5321234567" -> "(0532) 123 45 67"
 *
 * // format: "*** *** ** **"
 * // "905321234567" -> "532 123 45 67"
 */
export function NormalizePhoneNumber(
  options: NormalizePhoneNumberOptions = {
    skipNullish: true,
  },
) {
  return Transform(({ value }) => {
    try {
      // Null veya undefined değerleri kontrol et
      if (value == null) {
        if (options.skipNullish) {
          return value;
        }
        return options.defaultValue ?? value;
      }

      // String değilse string'e çevir
      const stringValue = String(value);

      // Tüm rakam olmayan karakterleri kaldır
      let cleaned = stringValue.replace(/\D/g, '');

      // +90 ile başlıyorsa (90 ile başlar), 90'ı kaldır
      if (cleaned.startsWith('90') && cleaned.length > 10) {
        cleaned = cleaned.substring(2);
      }

      // 0 ile başlıyorsa ve 11 haneliyse, başındaki 0'ı kaldır
      if (cleaned.startsWith('0') && cleaned.length === 11) {
        cleaned = cleaned.substring(1);
      }

      // Eğer 10 haneli bir numara elde ettiysek ve format istenmişse
      if (options.format && cleaned.length === 10) {
        let formatted: string = options.format;
        for (const digit of cleaned) {
          formatted = formatted.replace('*', digit);
        }
        return formatted;
      }

      // 5 ile başlayan 10 haneli numaraya 0 ekle (Varsayılan Türkiye formatı)
      if (cleaned.startsWith('5') && cleaned.length === 10) {
        cleaned = cleaned;
      }

      return cleaned;
    } catch (error) {
      if (options.defaultValue !== undefined) {
        return options.defaultValue;
      }
      return value;
    }
  });
}
