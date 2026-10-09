import "fastify";
import "@fastify/session";
import type { SessionUser } from "#/types/session-user.type.js";

declare module "fastify" {
  interface FastifyRequest {
    /**
     * Passport OAuth stratejilerinin doğrulama sonrası bıraktığı ham profil.
     * Uygulama kimliği için `request.session.get("user")` kullanılır.
     */
    user?: unknown;
  }

  /** `@fastify/session` store'unda tutulan oturum verisi. */
  interface Session {
    /** Giriş yapmış kullanıcı. Yoksa oturum anonimdir. */
    user?: SessionUser;
    /** Oturumun açıldığı cihazın user-agent'ı (cihaz değişimi tespiti için). */
    userAgent?: string | null;
    /** Oturumun açıldığı IP adresi. */
    ipAddress?: string | null;
    /** Oturumun açılma anı (ISO 8601). */
    createdAt?: string;
    /** Oturumu açan istemci türü. Mobilde oturum Bearer token ile taşınır. */
    client?: "web" | "mobile";
    /** Mobil oturumun bağlı olduğu cihaz (`X-Device-Id`). Web'de `null`. */
    deviceId?: string | null;
  }
}
