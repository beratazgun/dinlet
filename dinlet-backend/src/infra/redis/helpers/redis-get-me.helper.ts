import { Injectable } from "@nestjs/common";
import { RedisService } from "#/infra/redis/redis.service.js";

@Injectable()
export class RedisGetMeHelper {
  constructor(private readonly redisService: RedisService) {}

  private cacheKey(userId: number) {
    return this.redisService.createKey("PUBLIC_ME", userId);
  }

  async get<T>(userId: number): Promise<T | null> {
    return this.redisService.getJson<T>(this.cacheKey(userId));
  }

  async set<T>(userId: number, data: T): Promise<void> {
    await this.redisService.setJson(this.cacheKey(userId), data);
  }

  async invalidate(userId: number): Promise<void> {
    await this.redisService.del(this.cacheKey(userId));
  }
}
