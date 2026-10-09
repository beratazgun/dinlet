/**
 * Hesap kilitleme kuralı: aynı e-posta için `LOGIN_FAILURE_WINDOW_SECONDS`
 * içinde `MAX_FAILED_LOGIN_ATTEMPTS` başarısız deneme olursa giriş
 * `LOGIN_LOCK_SECONDS` boyunca kilitlenir.
 *
 * Sayaç kullanıcıya değil e-postaya bağlıdır: kayıtlı olmayan adresler de
 * aynı şekilde kilitlenir, böylece kilit davranışı hangi e-postaların kayıtlı
 * olduğunu ele vermez. IP bazlı hız sınırı (throttler) bunu tamamlar: biri tek
 * kaynaktan çok hesabı, diğeri çok kaynaktan tek hesabı korur.
 */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60;
export const LOGIN_LOCK_SECONDS = 15 * 60;

/** Bu başarısızlıkla kilit eşiğine ulaşıldı mı? */
export function isLockoutThresholdReached(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
}

/** Kilitli hesap için kullanıcıya gösterilen mesaj. */
export function accountLockedMessage(retryAfterSeconds: number): string {
  return `Çok sayıda başarısız giriş denemesi. Lütfen ${Math.ceil(retryAfterSeconds / 60)} dakika sonra tekrar deneyin veya şifrenizi sıfırlayın.`;
}
