import type { FastifyRequest, Session } from "fastify";
import type { SessionUser } from "#/types/session-user.type.js";

/**
 * İstekteki oturumdan kullanıcıyı okur.
 *
 * `@fastify/session` cookie `path`'i dışındaki rotalarda `request.session`'ı
 * düz bir obje olarak bırakır (`.get` yoktur). Guard, interceptor ve
 * `@CurrentUser()` bu tek yardımcıyı kullanır ki kontrol tek yerde dursun.
 */
export function getSessionUser(
  request: FastifyRequest,
): SessionUser | undefined {
  const session = request.session;
  return typeof session?.get === "function" ? session.get("user") : undefined;
}

/**
 * Oturumun açıldığı cihaz ile isteği yapan cihazın farklı olup olmadığını
 * söyler — çalınmış bir oturum cookie'sinin başka bir istemcide kullanılmasını
 * yakalamak için.
 *
 * Tarayıcı güncellemeleri yüzünden boşuna oturum düşmesin diye sürüm
 * numaraları karşılaştırma öncesi normalize edilir. Taraflardan biri
 * user-agent göndermiyorsa karar verilemez ve uyuşmazlık sayılmaz.
 */
export function isDeviceMismatch(
  storedUserAgent: string | null | undefined,
  currentUserAgent: string | null | undefined,
): boolean {
  if (!storedUserAgent || !currentUserAgent) return false;

  const normalize = (userAgent: string) =>
    userAgent.replace(/\/[\d.]+/g, "/").toLowerCase();

  return normalize(storedUserAgent) !== normalize(currentUserAgent);
}

/** Oturumun kullanıldığı istemciden gelen cihaz bilgisi. */
export interface ClientDevice {
  userAgent: string | null | undefined;
  deviceId: string | null | undefined;
}

/**
 * Oturum, açıldığı cihazdan başka bir cihazda mı kullanılıyor?
 *
 * Mobil oturumlar `X-Device-Id` ile bağlanır; user-agent uygulama
 * güncellemelerinde değiştiği için mobilde ona bakılmaz. Cihaz kimliği
 * gönderilmezse uyuşmazlık sayılır (token tek başına taşınamasın). Web
 * oturumlarında user-agent karşılaştırılır.
 */
export function isSessionDeviceMismatch(
  session: Pick<Session, "deviceId" | "userAgent">,
  device: ClientDevice,
): boolean {
  if (session.deviceId) return session.deviceId !== device.deviceId;
  return isDeviceMismatch(session.userAgent, device.userAgent);
}
