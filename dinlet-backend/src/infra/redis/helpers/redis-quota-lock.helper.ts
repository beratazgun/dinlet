import { randomUUID } from "node:crypto";

import { ConflictException, Injectable } from "@nestjs/common";

import { RedisService } from "#/infra/redis/redis.service.js";

const ATTEMPTS = 20;
const RETRY_DELAY_MS = 100;

/**
 * Kullanıcı başına kota kilidi (`quota:lock:<userId>`). Aynı kullanıcının
 * eşzamanlı yüklemeleri kota kontrolü + düşüm adımını sırayla yapar; böylece
 * iki istek aynı boş kotayı birlikte harcayamaz.
 */
@Injectable()
export class RedisQuotaLockHelper {
  constructor(private readonly redisService: RedisService) {}

  async withLock<T>(userId: number, work: () => Promise<T>): Promise<T> {
    const key = this.redisService.createKey("QUOTA_LOCK", userId);
    const token = randomUUID();

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if (await this.redisService.acquireLock(key, token)) {
        try {
          return await work();
        } finally {
          await this.redisService.releaseLock(key, token);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    throw new ConflictException(
      "Başka bir yükleme işleniyor. Lütfen birkaç saniye sonra tekrar deneyin.",
    );
  }
}
