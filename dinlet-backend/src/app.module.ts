import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { Redis } from "ioredis";

import { validateEnv } from "#config/env.validation.js";
import { CaslAbilityFactory } from "#/core/casl/index.js";
import { HttpExceptionFilter } from "#/core/exception-filters/index.js";
import {
  AuthGuard,
  CustomThrottlerGuard,
  PoliciesGuard,
} from "#/core/guards/index.js";
import { ResponseInterceptor } from "#/core/interceptors/index.js";
import { DatabaseModule } from "#database/database.module.js";
import { AuditModule } from "#/infra/audit/index.js";
import { HealthModule } from "#/infra/health/index.js";
import { JobModule } from "#/infra/job/index.js";
import { LlmModule } from "#/infra/llm/index.js";
import { NotificationsModule } from "#/infra/notifications/index.js";
import { ObservabilityModule } from "#/infra/observability/index.js";
import { QueueModule } from "#/infra/queue/index.js";
import { REDIS_CONNECTION } from "#/infra/redis/redis.constants.js";
import { RedisModule } from "#/infra/redis/redis.module.js";
import { S3Module } from "#/infra/s3/s3.module.js";
import { AuthModule } from "#/modules/auth/auth.module.js";
import { BillingModule } from "#/modules/billing/billing.module.js";
import { DocumentModule } from "#/modules/document/document.module.js";
import { MediaModule } from "#/modules/media/media.module.js";
import { NotificationModule } from "#/modules/notification/notification.module.js";
import { StudyModule } from "#/modules/study/study.module.js";
import { StoreModule } from "#/modules/store/store.module.js";
import { RecordingModule } from "#/modules/recording/recording.module.js";
import { UtilsModule } from "#/modules/utils/utils.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["config/.env"],
      validate: validateEnv,
    }),
    DatabaseModule,
    RedisModule.forRootAsync(),
    QueueModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRootAsync({
      // REDIS_CONNECTION global (RedisModule @Global) — imports boş kalabilir.
      imports: [],
      inject: [REDIS_CONNECTION],
      useFactory: (redis: Redis) => ({
        // Uçlar `@Throttle({ short, medium })` ile bu adlı pencereleri daraltır;
        // ad eşleşmezse override sessizce yok sayılır.
        throttlers: [
          { name: "short", ttl: 60_000, limit: 100 },
          { name: "medium", ttl: 300_000, limit: 500 },
        ],
        // Rate-limit sayaçları Redis'te → çok-instance'ta tutarlı.
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
    S3Module,
    NotificationsModule,
    LlmModule,
    ObservabilityModule,
    AuditModule,
    JobModule,
    HealthModule,
    AuthModule,
    MediaModule,
    BillingModule,
    DocumentModule,
    StudyModule,
    StoreModule,
    RecordingModule,
    NotificationModule,
    UtilsModule,
  ],
  providers: [
    // Guard sırası: oturum → yetki → hız sınırı.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PoliciesGuard },
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
    CaslAbilityFactory,
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
