import { Injectable } from "@nestjs/common";
import type { Session } from "fastify";
import { RedisService } from "#/infra/redis/redis.service.js";
import { RedisSessionStore } from "#/infra/session/redis-session.store.js";

/** Bir kullanıcının açık oturumunun listelenebilir özeti. */
export interface StoredSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string | null;
  expiresAt: string | null;
}

/**
 * Kullanıcı → açık oturumlar defteri.
 *
 * `@fastify/session` store'u yalnızca `session:<sessionId>` kaydını tutar;
 * "bu kullanıcının hangi oturumları açık?" sorusunu cevaplayabilmek için
 * ayrıca `user:sessions:<userId>` set'inde oturum id'leri indekslenir.
 *
 * Set, oturumlar TTL ile düştükçe bayatlar; `list` okurken karşılığı kalmayan
 * id'leri temizleyerek defteri kendi kendine onarır.
 */
@Injectable()
export class RedisSessionHelper {
  constructor(private readonly redisService: RedisService) {}

  private indexKey(userId: number) {
    return this.redisService.createKey("USER_SESSIONS", userId);
  }

  /** Yeni açılan oturumu kullanıcının defterine ekler. */
  async register(userId: number, sessionId: string): Promise<void> {
    await this.redisService.sAdd(this.indexKey(userId), sessionId);
  }

  /** Oturumu defterden düşürür (store kaydına dokunmaz). */
  async unregister(userId: number, sessionId: string): Promise<void> {
    await this.redisService.sRem(this.indexKey(userId), sessionId);
  }

  /** Kullanıcının açık oturumlarını, en yeniden eskiye doğru döndürür. */
  async list(userId: number): Promise<StoredSession[]> {
    const sessionIds = await this.redisService.sMembers(this.indexKey(userId));
    if (sessionIds.length === 0) return [];

    const sessions: StoredSession[] = [];
    const staleIds: string[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.read(sessionId);
      if (!session) {
        staleIds.push(sessionId);
        continue;
      }
      sessions.push(this.toStoredSession(sessionId, session));
    }

    if (staleIds.length > 0) {
      await this.redisService.sRem(this.indexKey(userId), ...staleIds);
    }

    return sessions.sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    );
  }

  /** Tek bir oturumu sonlandırır ve defterden düşürür. */
  async destroy(userId: number, sessionId: string): Promise<void> {
    await this.redisService.del(RedisSessionStore.key(sessionId));
    await this.unregister(userId, sessionId);
  }

  /** Kullanıcının tüm oturumlarını sonlandırır (hesap silme, şifre sıfırlama). */
  async destroyAll(userId: number): Promise<void> {
    const sessionIds = await this.redisService.sMembers(this.indexKey(userId));
    await this.redisService.delMany(sessionIds.map(RedisSessionStore.key));
    await this.redisService.del(this.indexKey(userId));
  }

  /** Oturumun hâlâ store'da yaşayıp yaşamadığını söyler. */
  async exists(sessionId: string): Promise<boolean> {
    return (await this.read(sessionId)) !== null;
  }

  private read(sessionId: string): Promise<Session | null> {
    return this.redisService.getJson<Session>(RedisSessionStore.key(sessionId));
  }

  private toStoredSession(sessionId: string, session: Session): StoredSession {
    const expires = session.cookie?.expires;
    return {
      id: sessionId,
      userAgent: session.userAgent ?? null,
      ipAddress: session.ipAddress ?? null,
      createdAt: session.createdAt ?? null,
      expiresAt: expires ? new Date(expires).toISOString() : null,
    };
  }
}
