import type { Session } from "fastify";
import type { Redis } from "ioredis";
import { RedisKey } from "#/infra/redis/redis-keys.js";

type StoreCallback = (error?: unknown) => void;
type StoreGetCallback = (error: unknown, session?: Session | null) => void;

/**
 * `@fastify/session` için ioredis tabanlı store.
 *
 * Plugin'in store sözleşmesi callback tabanlıdır: `set` / `get` / `destroy`.
 *
 * `RedisService`'in aksine burada **fail-open değiliz**: yazma hatası
 * callback'e iletilir ki başarısız bir `save()` sessizce yutulup kullanıcıya
 * "giriş yapıldı" denmesin. Okuma tarafında ise Redis'te kayıt bulunmaması
 * hata değildir — plugin bu durumda yeni bir anonim oturum üretir.
 */
export class RedisSessionStore {
  constructor(private readonly redisClient: Redis) {}

  set(sessionId: string, session: Session, callback: StoreCallback): void {
    const key = RedisSessionStore.key(sessionId);
    const ttl = this.resolveTtl(session, key.ttl);

    this.redisClient
      .setex(key.toString(), ttl, JSON.stringify(session))
      .then(() => callback())
      .catch(callback);
  }

  get(sessionId: string, callback: StoreGetCallback): void {
    this.redisClient
      .get(RedisSessionStore.key(sessionId).toString())
      .then((raw) => {
        if (!raw) return callback(null, null);

        try {
          callback(null, JSON.parse(raw) as Session);
        } catch {
          // Bozuk kayıt: oturumu yok say, plugin yenisini üretsin.
          callback(null, null);
        }
      })
      .catch(callback);
  }

  destroy(sessionId: string, callback: StoreCallback): void {
    this.redisClient
      .del(RedisSessionStore.key(sessionId).toString())
      .then(() => callback())
      .catch(callback);
  }

  /**
   * `get`'in promise sürümü — HTTP dışı kanalların (WebSocket el sıkışması)
   * oturumu okuması için. Okuma hatası "oturum yok" sayılır.
   */
  load(sessionId: string): Promise<Session | null> {
    return new Promise((resolve) => {
      this.get(sessionId, (error, session) =>
        resolve(error ? null : (session ?? null)),
      );
    });
  }

  /** Bir oturum id'sinin Redis key'ini üretir (key şemasının tek merkezi). */
  static key(sessionId: string): RedisKey {
    return RedisKey.create("SESSION", sessionId);
  }

  /**
   * Redis TTL'ini cookie'nin kalan ömründen hesaplar; böylece store kaydı
   * cookie ile aynı anda ölür ve `rolling` her istekte ikisini de tazeler.
   */
  private resolveTtl(session: Session, fallbackTtl: number): number {
    const expires = session.cookie?.expires;
    if (expires) {
      const remaining = Math.ceil(
        (new Date(expires).getTime() - Date.now()) / 1000,
      );
      if (remaining > 0) return remaining;
    }

    const maxAge = session.cookie?.originalMaxAge;
    if (maxAge && maxAge > 0) return Math.ceil(maxAge / 1000);

    return fallbackTtl;
  }
}
