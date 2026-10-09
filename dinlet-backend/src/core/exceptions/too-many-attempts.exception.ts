import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * İşlem geçici olarak engellendi; belirtilen süre sonra tekrar denenebilir
 * (→ 429 + `Retry-After`). Ör. çok sayıda başarısız giriş sonrası kilit.
 * `retryAfterSeconds` yanıtın `data` alanında da döner.
 */
export class TooManyAttemptsException extends HttpException {
  constructor(
    message: string,
    /** Tekrar denemeden önce beklenecek süre (saniye). */
    public readonly retryAfterSeconds: number,
  ) {
    super({ message, retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
