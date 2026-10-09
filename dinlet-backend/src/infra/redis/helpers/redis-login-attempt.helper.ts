import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { RedisService } from "#/infra/redis/redis.service.js";

/**
 * E-posta bazlı başarısız giriş sayacı ve geçici giriş kilidi.
 * E-posta key'e açık yazılmaz (Redis'te kişisel veri bırakmamak için) —
 * normalize edilip hash'lenir.
 */
@Injectable()
export class RedisLoginAttemptHelper {
  constructor(private readonly redisService: RedisService) {}

  /** Kilit varsa kalan süre (saniye); yoksa `0`. */
  lockedForSeconds(email: string): Promise<number> {
    return this.redisService.ttl(this.lockKey(email));
  }

  /** Başarısızlığı sayar; pencere içindeki toplam deneme sayısını döner. */
  recordFailure(email: string, windowSeconds: number): Promise<number> {
    return this.redisService.increment(this.failuresKey(email), windowSeconds);
  }

  async lock(email: string, seconds: number): Promise<void> {
    await this.redisService.set(this.lockKey(email), "1", seconds);
    await this.redisService.del(this.failuresKey(email));
  }

  /** Sayaç ve kilidi kaldırır (başarılı giriş veya şifre değişimi). */
  async reset(email: string): Promise<void> {
    await this.redisService.delMany([
      this.failuresKey(email),
      this.lockKey(email),
    ]);
  }

  private failuresKey(email: string) {
    return this.redisService.createKey("LOGIN_FAILURES", hashEmail(email));
  }

  private lockKey(email: string) {
    return this.redisService.createKey("LOGIN_LOCK", hashEmail(email));
  }
}

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
