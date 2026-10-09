import type { AppRule } from "#/core/casl/casl-ability.type.js";
import { Injectable } from "@nestjs/common";
import { RedisService } from "#/infra/redis/redis.service.js";
import { redisKeyPattern } from "#/infra/redis/redis-keys.js";

@Injectable()
export class RedisPermissionHelper {
  constructor(private readonly redisService: RedisService) {}

  private cacheKey(roleId: number) {
    return this.redisService.createKey("ROLE_PERMISSIONS", roleId);
  }

  async get(roleId: number): Promise<AppRule[] | null> {
    return this.redisService.getJson<AppRule[]>(this.cacheKey(roleId));
  }

  async set(roleId: number, rules: AppRule[]): Promise<void> {
    await this.redisService.setJson(this.cacheKey(roleId), rules);
  }

  async invalidate(roleId: number): Promise<void> {
    await this.redisService.del(this.cacheKey(roleId));
  }

  async invalidateAll(): Promise<void> {
    await this.redisService.deleteByPattern(
      redisKeyPattern("ROLE_PERMISSIONS"),
    );
  }
}
