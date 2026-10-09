import { randomUUID } from "node:crypto";
import compress from "@fastify/compress";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import session from "@fastify/session";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import qs from "qs";

import { AppModule } from "#/app.module.js";
import { AuditHttpHook } from "#/infra/audit/index.js";
import type { EnvType } from "#config/env.validation.js";
import {
  isObservabilityEnabled,
  ObserveInstrument,
} from "#/infra/observability/index.js";
import { REDIS_CONNECTION } from "#/infra/redis/redis.constants.js";
import {
  buildSessionCookieOptions,
  RedisSessionStore,
  registerBearerSession,
  SessionIoAdapter,
} from "#/infra/session/index.js";
import { MediaUrl } from "#/core/utils/index.js";
import { registerQueueBoard } from "#/infra/queue/board/queue-board.js";

export interface CreateAppOptions {
  /**
   * Fastify'ın (pino tabanlı) request logger'ı. Testlerde kapatılır; bu
   * durumda Nest logger'ı da yalnızca hataları yazar.
   */
  logger?: boolean | Record<string, unknown>;
}

/**
 * Uygulamayı tüm HTTP/WebSocket pipeline'ıyla kurar ama dinlemeye başlamaz.
 * `main.ts` ve e2e testleri aynı kurulumu kullanır; böylece testler
 * production ile birebir aynı plugin, guard ve adapter zincirinden geçer.
 */
export async function createApp(
  options: CreateAppOptions = {},
): Promise<NestFastifyApplication> {
  const isDev = process.env.NODE_ENV === "development";
  const fastifyLogger =
    options.logger !== undefined
      ? options.logger
      : isDev
        ? {
            transport: {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss",
                ignore: "pid,hostname",
                colorize: true,
              },
            },
            level: "info",
          }
        : true;

  const adapter = new FastifyAdapter({
    routerOptions: { querystringParser: (value) => qs.parse(value) },
    logger: fastifyLogger,
    trustProxy: true,
    // Korelasyon kimliği: geçerli bir `x-request-id` gelirse korunur, yoksa
    // UUID üretilir. Yanıta ve denetim kaydına aynı değer yazılır.
    requestIdHeader: false,
    genReqId: (request: {
      headers: Record<string, string | string[] | undefined>;
    }) => {
      const incoming = request.headers["x-request-id"];
      return typeof incoming === "string" && /^[\w-]{8,128}$/.test(incoming)
        ? incoming
        : randomUUID();
    },
    connectionTimeout: 30_000,
    keepAliveTimeout: 65_000,
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    {
      ...(options.logger === false
        ? { logger: ["error"] as const }
        : isDev
          ? { logger: ["log", "error", "warn", "debug", "verbose"] }
          : {}),
      // Provider'ları span üretecek şekilde sarar. `AppModule` import edilirken
      // ConfigModule `config/.env`'i process.env'e yüklediği için kontrol
      // burada güvenilirdir.
      ...(isObservabilityEnabled() ? { instrument: ObserveInstrument } : {}),
    },
  );

  const config = app.get(ConfigService<EnvType>);
  const nodeEnv = config.get("NODE_ENV", { infer: true }) ?? "development";

  MediaUrl.configure(config.get("R2_CDN_BASE_URL", { infer: true })!);

  await app.register(cookie);

  // @fastify/session, cookie plugin'ine bağımlıdır ve ondan sonra kaydedilmeli.
  // Store olarak Redis kullanılır; plugin'in varsayılan in-memory store'u
  // bellek sızdırdığı için production'a uygun değildir.
  const sessionCookieName = config.getOrThrow("SESSION_COOKIE_NAME", {
    infer: true,
  });

  const sessionMaxAge = config.getOrThrow("SESSION_MAX_AGE", { infer: true });

  // Mobil: `Authorization: Bearer` başlığı oturum cookie'si gibi okunur.
  // Cookie plugin'inden sonra, session plugin'inden önce bağlanmalı.
  registerBearerSession(app.getHttpAdapter().getInstance(), sessionCookieName);

  const sessionSecret = config.getOrThrow("SESSION_SECRET", { infer: true });
  const redis = app.get(REDIS_CONNECTION);
  const sessionStore = new RedisSessionStore(redis);

  await app.register(session, {
    secret: sessionSecret,
    cookieName: sessionCookieName,
    store: sessionStore,
    // Anonim ziyaretçiler için Redis'te kayıt açılmasın.
    saveUninitialized: false,
    // Her yanıtta oturum süresi sıfırlanır → ayrı bir "refresh" ucu gerekmez.
    rolling: true,
    cookie: buildSessionCookieOptions(config, {
      // Plugin maxAge'i milisaniye bekler (@fastify/cookie saniye bekler).
      maxAge: sessionMaxAge * 1_000,
    }),
  });

  // Denetim hook'ları oturum plugin'inden SONRA bağlanır; böylece oturumdaki
  // kullanıcı `onRequest`'te okunabilir.
  app.get(AuditHttpHook).register(app.getHttpAdapter().getInstance());

  await app.register(compress, { encodings: ["br", "gzip"] });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  });

  await app.register(multipart, { limits: { fileSize: 30 * 1_024 * 1_024 } });

  const allowedOrigins =
    nodeEnv === "production"
      ? [config.get("FRONTEND_URL", { infer: true })!]
      : [
          "http://localhost:3002",
          "http://localhost:3001",
          "http://localhost:3000",
        ];

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PATCH", "PUT", "OPTIONS"],
    maxAge: 86_400,
  });

  // WebSocket: HTTP ile aynı oturum cookie'si ve origin listesi; çok-instance
  // yayın Redis adapter'ı üzerinden.
  app.useWebSocketAdapter(
    new SessionIoAdapter(app, {
      cookieName: sessionCookieName,
      secret: sessionSecret,
      allowedOrigins,
      readSession: (sessionId) => sessionStore.load(sessionId),
      redis,
    }),
  );

  // Kuyruk paneli: yalnızca admin oturumlarına açık (`/admin/queues`).
  await registerQueueBoard(app, app.getHttpAdapter().getInstance());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );
  app.setGlobalPrefix("api/v1", {
    exclude: ["robots.txt", "sitemap.xml", "sitemap-*path.xml"],
  });

  if (nodeEnv === "development") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Dinlet API")
      .setDescription("API Dokümantasyonu")
      .setVersion("1.0")
      .addCookieAuth(sessionCookieName, {
        type: "apiKey",
        in: "cookie",
        name: sessionCookieName,
        description: "Oturum cookie'si ile authentication",
      })
      .addBearerAuth({
        type: "http",
        scheme: "bearer",
        description:
          "Mobil: `X-Client: mobile` ile girişte dönen `accessToken`. `X-Device-Id` başlığı da gönderilmelidir.",
      })
      .addSecurityRequirements("bearer")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      deepScanRoutes: true,
      autoTagControllers: true,
      ignoreGlobalPrefix: false,
    });

    SwaggerModule.setup("/api/v1/doc", app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
        docExpansion: "none",
        filter: true,
        tryItOutEnabled: true,
        defaultModelsExpandDepth: 3,
        defaultModelExpandDepth: 3,
      },
      customSiteTitle: "Dinlet API Docs",
    });
  }

  // SIGTERM/SIGINT'te DB/Redis bağlantıları ve onModuleDestroy/onApplicationShutdown
  // kancaları düzgün tetiklensin diye graceful shutdown açılır.
  app.enableShutdownHooks();

  return app;
}
