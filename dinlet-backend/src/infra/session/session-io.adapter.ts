import { fastifyCookie } from "@fastify/cookie";
import type { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Session } from "fastify";
import type { Redis } from "ioredis";
import type { Namespace, Server, ServerOptions, Socket } from "socket.io";

import type { SessionUser } from "#/types/session-user.type.js";
import {
  DEVICE_ID_HEADER,
  normalizeDeviceId,
  readBearerToken,
} from "#/infra/session/session-client.js";
import { isSessionDeviceMismatch } from "#/infra/session/session.utils.js";

export interface SessionIoAdapterOptions {
  /** `@fastify/session` cookie adı ve imzalama anahtarı (HTTP ile aynı). */
  cookieName: string;
  secret: string;
  /** El sıkışmasına izin verilen `Origin`'ler (HTTP CORS listesiyle aynı). */
  allowedOrigins: string[];
  /** Oturum id'sinden oturumu okur (ör. `RedisSessionStore.load`). */
  readSession: (sessionId: string) => Promise<Session | null>;
  /** Çok-instance yayın için Redis bağlantısı; pub/sub için kopyalanır. */
  redis: Redis;
}

/** Bağlantı sırasında doğrulanan kullanıcı: `socket.data.user`. */
export interface AuthenticatedSocketData {
  user: SessionUser;
}

/**
 * HTTP ile aynı oturumla kimlik doğrulayan Socket.IO adapter'ı. Oturum
 * kimliği tarayıcıda cookie'den, mobilde el sıkışmadaki `auth.token`'dan
 * (veya `Authorization: Bearer` başlığından) okunur.
 *
 * - **Origin denetimi:** WebSocket taşıması CORS'a tabi değildir; başka bir
 *   sitenin kullanıcının cookie'siyle bağlanmasını (cross-site WebSocket
 *   hijacking) engellemek için `Origin` el sıkışmada kontrol edilir.
 * - **Kimlik:** imzalı cookie çözülür, oturum store'dan okunur; oturumda
 *   kullanıcı yoksa veya cihaz değişmişse bağlantı reddedilir.
 * - **Ölçek:** Redis adapter'ı sayesinde `server.to(room).emit(...)` tüm
 *   instance'lardaki soketlere ulaşır.
 */
export class SessionIoAdapter extends IoAdapter {
  private readonly signer;
  private readonly redisAdapter;
  private readonly pubSubClients: Redis[];

  constructor(
    app: INestApplicationContext,
    private readonly options: SessionIoAdapterOptions,
  ) {
    super(app);
    this.signer = fastifyCookie.signerFactory(options.secret);
    const [pubClient, subClient] = [
      options.redis.duplicate(),
      options.redis.duplicate(),
    ];
    this.pubSubClients = [pubClient, subClient];
    this.redisAdapter = createAdapter(pubClient, subClient);
  }

  /** Sunucu kapanırken pub/sub bağlantıları da kapatılır (graceful shutdown). */
  override async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.allSettled(
      this.pubSubClients
        .filter((client) => client.status !== "end")
        .map((client) => client.quit()),
    );
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.options.allowedOrigins, credentials: true },
      allowRequest: (request, callback) =>
        callback(null, this.isAllowedOrigin(request.headers.origin)),
    } as ServerOptions) as Server;
    server.adapter(this.redisAdapter);
    return server;
  }

  override create(
    port: number,
    options?: ServerOptions & { namespace?: string; server?: Server },
  ): Server | Namespace {
    const target = super.create(port, options);
    // Her namespace kendi middleware zincirine sahiptir; Nest her gateway için
    // `create`'i çağırdığından doğrulama burada her birine eklenir.
    target.use((socket, next) => {
      this.authenticate(socket)
        .then((user) => {
          if (!user) return next(new Error("Oturum açmanız gerekmektedir"));
          (socket.data as AuthenticatedSocketData).user = user;
          next();
        })
        .catch(() => next(new Error("Oturum doğrulanamadı")));
    });
    return target;
  }

  private isAllowedOrigin(origin: string | undefined): boolean {
    // Tarayıcı dışı istemciler (mobil, sunucu) Origin göndermez; cookie
    // olmadan zaten kimlik doğrulayamazlar.
    return !origin || this.options.allowedOrigins.includes(origin);
  }

  private async authenticate(socket: Socket): Promise<SessionUser | null> {
    const signed = this.readSignedSessionId(socket);
    if (!signed) return null;

    const unsigned = this.signer.unsign(signed);
    if (!unsigned.valid || !unsigned.value) return null;

    const session = await this.options.readSession(unsigned.value);
    if (!session?.user) return null;

    const auth = socket.handshake.auth as Record<string, unknown>;
    const device = {
      userAgent: socket.handshake.headers["user-agent"],
      deviceId: normalizeDeviceId(
        auth.deviceId ?? socket.handshake.headers[DEVICE_ID_HEADER],
      ),
    };
    if (isSessionDeviceMismatch(session, device)) return null;

    return session.user;
  }

  /** İmzalı oturum kimliği: önce mobil token, yoksa oturum cookie'si. */
  private readSignedSessionId(socket: Socket): string | undefined {
    const auth = socket.handshake.auth as Record<string, unknown>;
    const token =
      (typeof auth.token === "string" && auth.token) ||
      readBearerToken(socket.handshake.headers.authorization);
    if (token) return token;

    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) return undefined;
    return fastifyCookie.parse(cookieHeader)[this.options.cookieName];
  }
}
