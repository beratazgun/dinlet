import { applyDecorators } from "@nestjs/common";
import { IsString, MaxLength, MinLength } from "class-validator";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

/**
 * Hesap şifresinin tek kuralı: 8–64 karakter. Kayıt, şifre sıfırlama ve
 * şifre değiştirme aynı kuralı kullanır; mobil formlar da bunu uygular.
 * Karakter sınıfı zorunluluğu yoktur (NIST SP 800-63B: uzunluk, karmaşıklık
 * kuralından daha etkilidir); kaba kuvvete karşı giriş kilidi ve throttle var.
 */
export function IsAccountPassword(label = "Şifre") {
  return applyDecorators(
    IsString({ message: `${label} metin olmalıdır` }),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `${label} en az ${PASSWORD_MIN_LENGTH} karakter olmalıdır`,
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: `${label} en fazla ${PASSWORD_MAX_LENGTH} karakter olmalıdır`,
    }),
  );
}
