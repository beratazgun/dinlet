import { Inject, Injectable, Logger } from "@nestjs/common";
import { Redis } from "ioredis";
import { REDIS_CONNECTION } from "#/infra/redis/redis.constants.js";
import {
  REDIS_KEY_SUFFIX,
  RedisCacheClearEntry,
  RedisKey,
  RedisKeyName,
  RedisKeyParams,
} from "#/infra/redis/redis-keys.js";

/**
 * Redis ile tip-güvenli, ince bir facade.
 *
 * Tüm operasyonlar **fail-open**'dır: Redis erişilemezse hata fırlatmak yerine
 * güvenli bir varsayılan döner (okuma → `null`, yazma/silme → no-op) ve loglar.
 * Böylece bir cache/Redis kesintisi isteği bozmaz.
 *
 * Generic key operasyonları (get/set/del/`clear`) burada; bir key'e özel
 * domain semantiği için bir helper yazın (ör. `RedisGetMeHelper`).
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CONNECTION) private readonly redisClient: Redis) {}

  /** Tip-güvenli Redis key oluştur. */
  createKey(name: RedisKeyName, suffix: string | number): RedisKey {
    return RedisKey.create(name, suffix);
  }

  async get(key: RedisKey): Promise<string | null> {
    try {
      return await this.redisClient.get(key.toString());
    } catch (error) {
      this.logFailure("get", key.toString(), error);
      return null;
    }
  }

  async getJson<T>(key: RedisKey): Promise<T | null> {
    const result = await this.get(key);
    if (!result) return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return null;
    }
  }

  /**
   * JSON değeri okur ve aynı komutta siler (`GETDEL`). Tek seferlik
   * kayıtların iki kez tüketilmesini engeller.
   */
  async takeJson<T>(key: RedisKey): Promise<T | null> {
    let result: string | null;
    try {
      result = await this.redisClient.getdel(key.toString());
    } catch (error) {
      this.logFailure("getdel", key.toString(), error);
      return null;
    }
    if (!result) return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return null;
    }
  }

  /**
   * Sayacı artırır; ilk artışta key'in TTL'ini başlatır (sabit pencere).
   * Redis erişilemezse `0` döner (fail-open: sayaç devre dışı kalır).
   */
  async increment(key: RedisKey, customTtl?: number): Promise<number> {
    try {
      const [[, count]] = (await this.redisClient
        .multi()
        .incr(key.toString())
        .expire(key.toString(), customTtl ?? key.ttl, "NX")
        .exec()) as [[Error | null, number]];
      return count;
    } catch (error) {
      this.logFailure("increment", key.toString(), error);
      return 0;
    }
  }

  /** Key'in kalan ömrü (saniye); key yoksa veya Redis erişilemezse `0`. */
  async ttl(key: RedisKey): Promise<number> {
    try {
      return Math.max(0, await this.redisClient.ttl(key.toString()));
    } catch (error) {
      this.logFailure("ttl", key.toString(), error);
      return 0;
    }
  }

  /** Değer set et. TTL verilmezse key'in şemadaki varsayılan TTL'i kullanılır. */
  async set(key: RedisKey, value: string, customTtl?: number): Promise<void> {
    const ttl = customTtl ?? key.ttl;
    try {
      await this.redisClient.setex(key.toString(), ttl, value);
    } catch (error) {
      this.logFailure("set", key.toString(), error);
    }
  }

  async setJson<T>(key: RedisKey, value: T, customTtl?: number): Promise<void> {
    return this.set(key, JSON.stringify(value), customTtl);
  }

  async del(key: RedisKey): Promise<void> {
    try {
      await this.redisClient.del(key.toString());
    } catch (error) {
      this.logFailure("del", key.toString(), error);
    }
  }

  /** Birden fazla key'i tek pipeline round-trip'te siler. */
  async delMany(keys: RedisKey[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      const pipeline = this.redisClient.pipeline();
      for (const key of keys) {
        pipeline.del(key.toString());
      }
      await pipeline.exec();
    } catch (error) {
      this.logFailure(
        "delMany",
        keys.map((k) => k.toString()).join(","),
        error,
      );
    }
  }

  /** Bir veya daha fazla cache key'ini tek pipeline'da (tip-güvenli) siler. */
  async clear(entries: RedisCacheClearEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const keys = entries.map((entry) =>
      // `entry` korele bir union; suffix fonksiyonuna erişim için `never` cast.
      this.createKey(
        entry.key,
        REDIS_KEY_SUFFIX[entry.key](entry.params as never),
      ),
    );

    await this.delMany(keys);
  }

  /** Tek bir cache key'ini siler (tip-güvenli kısayol). */
  clearOne<K extends RedisKeyName>(
    key: K,
    params: RedisKeyParams[K],
  ): Promise<void> {
    return this.clear([{ key, params }] as RedisCacheClearEntry[]);
  }

  /** Bir set'e üye ekler ve set'in TTL'ini tazeler. */
  async sAdd(key: RedisKey, member: string, customTtl?: number): Promise<void> {
    try {
      await this.redisClient.sadd(key.toString(), member);
      await this.redisClient.expire(key.toString(), customTtl ?? key.ttl);
    } catch (error) {
      this.logFailure("sAdd", key.toString(), error);
    }
  }

  /**
   * Set'e üye ekler, TTL'i tazeler ve eklemenin sonucunu tek round-trip'te
   * döner. Redis erişilemezse `null`.
   */
  async sAddTracked(
    key: RedisKey,
    member: string,
    customTtl?: number,
  ): Promise<{ added: boolean; sizeBefore: number } | null> {
    try {
      const [[, sizeBefore], [, added]] = (await this.redisClient
        .multi()
        .scard(key.toString())
        .sadd(key.toString(), member)
        .expire(key.toString(), customTtl ?? key.ttl)
        .exec()) as [[Error | null, number], [Error | null, number]];
      return { added: added === 1, sizeBefore };
    } catch (error) {
      this.logFailure("sAddTracked", key.toString(), error);
      return null;
    }
  }

  /** Bir set'ten üye çıkarır. */
  async sRem(key: RedisKey, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    try {
      await this.redisClient.srem(key.toString(), ...members);
    } catch (error) {
      this.logFailure("sRem", key.toString(), error);
    }
  }

  /** Set üyelerini döndürür. Redis erişilemezse boş dizi döner. */
  async sMembers(key: RedisKey): Promise<string[]> {
    try {
      return await this.redisClient.smembers(key.toString());
    } catch (error) {
      this.logFailure("sMembers", key.toString(), error);
      return [];
    }
  }

  /** Pattern (glob) ile eşleşen tüm key'leri siler. */
  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length === 0) return;
      await this.redisClient.del(...keys);
    } catch (error) {
      this.logFailure("deleteByPattern", pattern, error);
    }
  }

  /**
   * Dağıtık kilit alır (`SET NX PX`). Kilit başkasındaysa `null`, alınırsa
   * bırakmak için gereken token döner. Diğer metodların aksine **fail-closed**:
   * Redis erişilemezse hata fırlatır; kilidin sessizce atlanması tutarlılığı
   * bozar.
   */
  async acquireLock(key: RedisKey, token: string): Promise<boolean> {
    const result = await this.redisClient.set(
      key.toString(),
      token,
      "PX",
      key.ttl * 1_000,
      "NX",
    );
    return result === "OK";
  }

  /** Kilidi yalnızca hâlâ aynı token'a aitse bırakır (süresi dolup başkası almışsa dokunmaz). */
  async releaseLock(key: RedisKey, token: string): Promise<void> {
    try {
      await this.redisClient.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) end return 0',
        1,
        key.toString(),
        token,
      );
    } catch (error) {
      // Bırakılamayan kilit TTL ile düşer.
      this.logFailure("releaseLock", key.toString(), error);
    }
  }

  private logFailure(op: string, key: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Redis '${op}' başarısız (${key}): ${message}`);
  }
}
