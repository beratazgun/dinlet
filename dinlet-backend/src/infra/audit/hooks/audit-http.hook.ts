import { Injectable, Logger } from "@nestjs/common";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  type AuditRouteOptions,
  extractClientMetadata,
} from "#/core/decorators/index.js";
import { AuditRecorderService } from "#/infra/audit/services/index.js";
import { getSessionUser } from "#/infra/session/index.js";
import type { SessionUser } from "#/types/index.js";

/** Bir isteğin yaşam döngüsü boyunca denetim için biriktirilen bilgi. */
export interface AuditRequestState {
  /** Logout gibi oturumu kapatan uçlarda da kullanıcıyı kaybetmemek için. */
  userAtStart: SessionUser | null;
  controller: string | null;
  handler: string | null;
  options: AuditRouteOptions;
  responsePayload?: string;
  changes?: unknown;
}

declare module "fastify" {
  interface FastifyRequest {
    audit?: AuditRequestState;
  }
}

/** Denetlenmeyen yollar: Swagger arayüzü ve dokümanı. */
const IGNORED_PATH_PREFIXES = ["/api/v1/doc"];
const IGNORED_METHODS = new Set(["OPTIONS", "HEAD"]);

/**
 * HTTP denetim kaydını Fastify hook'larıyla toplar.
 *
 * Nest interceptor'ı yerine hook kullanılır; böylece guard'ın reddettiği
 * (401/403/429), eşleşmeyen (404) ve filtre tarafından biçimlenen hata
 * yanıtları da — istemcinin gördüğü son gövde ve durum koduyla — kaydedilir.
 *
 * - `onRequest`: `x-request-id` yanıta yazılır, başlangıçtaki kullanıcı alınır.
 * - `onSend`:    serileştirilmiş son yanıt gövdesi yakalanır.
 * - `onResponse`: yanıt gönderildikten SONRA kayıt kuyruğa alınır (gecikme yok).
 *
 * `main.ts` içinde, oturum plugin'inden sonra `register()` ile bağlanır.
 */
@Injectable()
export class AuditHttpHook {
  private readonly logger = new Logger(AuditHttpHook.name);

  constructor(private readonly auditRecorder: AuditRecorderService) {}

  register(fastify: FastifyInstance): void {
    fastify.addHook("onRequest", async (request, reply) => {
      reply.header("x-request-id", request.id);
      request.audit = {
        userAtStart: getSessionUser(request) ?? null,
        controller: null,
        handler: null,
        options: {},
      };
    });

    fastify.addHook("onSend", async (request, _reply, payload) => {
      if (request.audit && typeof payload === "string") {
        request.audit.responsePayload = payload;
      }
      return payload;
    });

    fastify.addHook("onResponse", async (request, reply) => {
      try {
        if (this.shouldRecord(request)) {
          void this.auditRecorder.recordHttpRequest(
            this.buildRecord(request, reply),
          );
        }
      } catch (error) {
        this.logger.error(
          `Denetim kaydı hazırlanamadı (${request.id}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  private shouldRecord(request: FastifyRequest): boolean {
    if (!request.audit || request.audit.options.enabled === false) return false;
    if (IGNORED_METHODS.has(request.method)) return false;
    return !IGNORED_PATH_PREFIXES.some((prefix) =>
      request.url.startsWith(prefix),
    );
  }

  private buildRecord(request: FastifyRequest, reply: FastifyReply) {
    const state = request.audit!;
    const client = extractClientMetadata(request);
    const responseBody =
      state.options.captureResponseBody === false
        ? undefined
        : this.parseJson(state.responsePayload);

    return {
      requestId: request.id,
      method: request.method,
      route: request.routeOptions?.url ?? null,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
      user: getSessionUser(request) ?? state.userAtStart,
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
      controller: state.controller,
      handler: state.handler,
      headers: { ...request.headers },
      query: request.query,
      params: request.params,
      requestBody: this.resolveRequestBody(request, state),
      responseBody,
      changes: state.changes,
      errorMessage:
        reply.statusCode >= 400 ? this.extractErrorMessage(responseBody) : null,
    };
  }

  private resolveRequestBody(
    request: FastifyRequest,
    state: AuditRequestState,
  ): unknown {
    if (state.options.captureRequestBody === false) return undefined;
    if (request.isMultipart?.()) return "[MULTIPART]";
    return request.body;
  }

  private parseJson(payload: string | undefined): unknown {
    if (!payload) return null;
    try {
      return JSON.parse(payload) as unknown;
    } catch {
      return payload;
    }
  }

  /** RFC 7807 gövdesindeki `message` alanını tek satıra indirger. */
  private extractErrorMessage(body: unknown): string | null {
    if (typeof body === "string") return body.slice(0, 500);
    if (!body || typeof body !== "object") return null;
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join("; ");
    return typeof message === "string" ? message : null;
  }
}
