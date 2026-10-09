import { DynamicModule, Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnvType } from "#config/env.validation.js";
import { Redis } from "ioredis";
import { RedisService } from "#/infra/redis/redis.service.js";
import { REDIS_CONNECTION } from "#/infra/redis/redis.constants.js";
import { RedisPermissionHelper } from "#/infra/redis/helpers/redis-permission.helper.js";
import { RedisGetMeHelper } from "#/infra/redis/helpers/redis-get-me.helper.js";
import { RedisSessionHelper } from "#/infra/redis/helpers/redis-session.helper.js";
import { RedisPendingUploadHelper } from "#/infra/redis/helpers/redis-pending-upload.helper.js";
import { RedisLoginAttemptHelper } from "#/infra/redis/helpers/redis-login-attempt.helper.js";
import { RedisKnownDeviceHelper } from "#/infra/redis/helpers/redis-known-device.helper.js";
import { RedisQuotaLockHelper } from "#/infra/redis/helpers/redis-quota-lock.helper.js";

const RedisHelpers = [
  RedisPermissionHelper,
  RedisGetMeHelper,
  RedisSessionHelper,
  RedisPendingUploadHelper,
  RedisLoginAttemptHelper,
  RedisKnownDeviceHelper,
  RedisQuotaLockHelper,
];

@Global()
@Module({})
export class RedisModule {
  static forRootAsync(): DynamicModule {
    return {
      global: true,
      module: RedisModule,
      providers: [
        {
          provide: REDIS_CONNECTION,
          useFactory: (configService: ConfigService<EnvType>) =>
            this.connectRedis(configService),
          inject: [ConfigService<EnvType>],
        },
        {
          provide: RedisService,
          useFactory: (redisConnection: Redis) =>
            new RedisService(redisConnection),
          inject: [REDIS_CONNECTION],
        },
        ...RedisHelpers,
      ],
      exports: [REDIS_CONNECTION, RedisService, ...RedisHelpers],
    };
  }

  private static connectRedis(configService: ConfigService<EnvType>): Redis {
    const logger = new Logger("Redis");
    const port = configService.get<number>("REDIS_PORT");
    const host = configService.get<string>("REDIS_HOST");
    const password = configService.get<string>("REDIS_PASSWORD");

    const client = new Redis({
      port: Number(port),
      host,
      password: password || undefined,
      // Komut başına en fazla 3 deneme; sonrasında hata döner (istek asılı kalmaz).
      maxRetriesPerRequest: 3,
      // Üstel geri çekilme ile yeniden bağlanma (max 2sn).
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

    // 'error' dinleyicisi olmadan ioredis process'i çökertebilir; burada logluyoruz.
    client.on("error", (err) =>
      logger.error(`Bağlantı hatası: ${err.message}`),
    );
    client.on("ready", () => logger.log("🎉 Redis bağlantısı hazır"));

    return client;
  }
}
