import { randomUUID } from "node:crypto";

import { ConditionalModule, ConfigService } from "@nestjs/config";
import { createObserveModule } from "@nestjs/observe";

import type { EnvType } from "#config/env.validation.js";

/**
 * NestJS Observe (https://docs.nestjs.com/observability/overview): istek,
 * job, cron, WebSocket, DB sorgusu ve dışa giden HTTP çağrıları için trace,
 * hata gruplama ve runtime metrikleri.
 *
 * **İsteğe bağlıdır:** `OBSERVE_APP_KEY` ve `OBSERVE_APP_SECRET` verilmezse ne
 * modül yüklenir ne de provider'lar enstrümante edilir — sıfır maliyet.
 */
export function isObservabilityEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.OBSERVE_APP_KEY && env.OBSERVE_APP_SECRET);
}

interface RequestLike {
  id?: unknown;
  headers?: Record<string, unknown>;
  session?: { get?: (key: string) => { id?: number } | undefined };
}

export const { ObserveModule, ObserveInstrument } = createObserveModule({
  // Fastify'ın `request.id`'si (`x-request-id` ya da üretilen UUID) trace id
  // olur: audit kaydı, yanıt başlığı ve Observe trace'i aynı kimliği taşır.
  traceIdGenerator: (req) => {
    const id = (req as RequestLike | undefined)?.id;
    return typeof id === "string" ? id : randomUUID();
  },
  attachTraceIdToLogs: true,
});

/** `app.module.ts`'e eklenir; anahtarlar yoksa hiçbir şey kaydetmez. */
export const ObservabilityModule = ConditionalModule.registerWhen(
  ObserveModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService<EnvType>) => ({
      appKey: config.getOrThrow("OBSERVE_APP_KEY", { infer: true }),
      appSecret: config.getOrThrow("OBSERVE_APP_SECRET", { infer: true }),
      serviceId:
        config.get("OBSERVE_SERVICE_ID", { infer: true }) ??
        config.getOrThrow("APP_NAME", { infer: true }),
      tracesSampleRate: config.get("OBSERVE_TRACES_SAMPLE_RATE", {
        infer: true,
      }),
      http: {
        // Kimliği doğrulanmış kullanıcı panelin "Users" görünümüne düşer.
        getUserId: (req: unknown) => {
          const session = (req as RequestLike).session;
          const userId =
            typeof session?.get === "function"
              ? session.get("user")?.id
              : undefined;
          return userId === undefined ? "anonymous" : String(userId);
        },
        // Liveness/readiness probları trace üretmesin.
        ignore: [/\/api\/v1\/health/],
      },
      redaction: {
        // Yerleşik kurallar `…token`, `…secret`, `authorization` vb. zaten maskeler.
        keys: ["cookie", "set-cookie", "_csrf", "password", "currentPassword"],
      },
    }),
  }),
  (env) => isObservabilityEnabled(env),
);
