import type { ClearCookie } from "#/types/response/base-response.type.js";

/**
 * Exception'ların silinecek cookie listesini taşımasını sağlayan interface.
 * Herhangi bir exception bu interface'i implement ederse,
 * global HttpExceptionFilter bu listeyi yakalayıp cookie'leri temizler.
 */
export interface HasClearCookies {
  clearCookies: (string | ClearCookie)[];
}

/**
 * Bir objenin HasClearCookies interface'ini implement edip etmediğini kontrol eder.
 */
export function hasClearCookies(obj: any): obj is HasClearCookies {
  return obj && Array.isArray(obj.clearCookies);
}
