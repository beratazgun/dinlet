import type { FastifyInstance, FastifyRequest } from "fastify";

/** Mobil istemcinin kendini tanıttığı başlık: `X-Client: mobile`. */
export const CLIENT_HEADER = "x-client";
export const MOBILE_CLIENT = "mobile";

/**
 * Mobil uygulamanın kurulumda ürettiği kalıcı cihaz kimliği. User-agent
 * uygulama güncellemelerinde değiştiği için mobilde cihaz kontrolü buna göre
 * yapılır.
 */
export const DEVICE_ID_HEADER = "x-device-id";

const BEARER_PREFIX = /^Bearer\s+(\S+)$/i;
const DEVICE_ID_PATTERN = /^[\w-]{8,128}$/;

/** `Authorization: Bearer <token>` başlığındaki token; yoksa `undefined`. */
export function readBearerToken(
  authorization: string | string[] | undefined,
): string | undefined {
  if (typeof authorization !== "string") return undefined;
  return BEARER_PREFIX.exec(authorization.trim())?.[1];
}

/** İstek oturumunu `Authorization: Bearer` başlığıyla mı taşıyor? */
export function isBearerRequest(request: FastifyRequest): boolean {
  return readBearerToken(request.headers.authorization) !== undefined;
}

/** İstemci kendini mobil uygulama olarak tanıtıyor mu (`X-Client: mobile`)? */
export function isMobileClient(request: FastifyRequest): boolean {
  const client = request.headers[CLIENT_HEADER];
  return typeof client === "string" && client.toLowerCase() === MOBILE_CLIENT;
}

/** Geçerli biçimdeki `X-Device-Id` değeri; yoksa veya bozuksa `null`. */
export function normalizeDeviceId(value: unknown): string | null {
  return typeof value === "string" && DEVICE_ID_PATTERN.test(value)
    ? value
    : null;
}

/**
 * Mobil istemcinin `Authorization: Bearer <token>` başlığını oturum
 * cookie'siymiş gibi `@fastify/session`'a besleyen `onRequest` hook'u.
 *
 * Token, cookie'deki değerin aynısıdır (imzalı oturum kimliği; JWT değil).
 * Böylece oturum Redis'ten aynı yolla yüklenir; `rolling`, oturum listeleme ve
 * sonlandırma iki taşıma yolunda da aynı çalışır. Başlık varsa cookie'ye
 * tercih edilir.
 *
 * Sıra önemlidir: cookie plugin'i `request.cookies`'i doldurduktan SONRA,
 * session plugin'i oturumu okumadan ÖNCE kaydedilmelidir.
 */
export function registerBearerSession(
  fastify: FastifyInstance,
  cookieName: string,
): void {
  fastify.addHook("onRequest", (request, _reply, done) => {
    const token = readBearerToken(request.headers.authorization);
    if (token) request.cookies[cookieName] = token;
    done();
  });
}
