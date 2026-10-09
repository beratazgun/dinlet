import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { Observable } from "rxjs";

import { AUDIT_OPTIONS_KEY, TRACK_CHANGES_KEY } from "#/core/constants/index.js";
import type {
  AuditRouteOptions,
  TrackChangesOptions,
} from "#/core/decorators/index.js";
import { HttpSuccess } from "#/core/http/index.js";
import { calculateDiff } from "#/core/utils/index.js";
import { EntitySnapshotRepository } from "#/infra/audit/repository/index.js";
import { AuditContextService } from "#/infra/audit/services/index.js";

/**
 * Global interceptor:
 * 1. Denetim kaydına Nest'e ait controller, handler ve `@AuditOptions` bilgilerini ekler.
 * 2. `@TrackChanges` olan uçlarda güncelleme öncesi DB durumunu (`beforeState`)
 *    çeker; yanıt döndükten sonra yeni durumla (`afterState`) karşılaştırıp
 *    diff'i `AuditContextService`'e yazar.
 * 3. İstek tamamlandığında biriken değişiklikleri `request.audit.changes`'e aktarır.
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditContext: AuditContextService,
    private readonly entitySnapshot: EntitySnapshotRepository,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (context.getType() !== "http") return next.handle();

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const targets = [context.getHandler(), context.getClass()];

    if (request.audit) {
      request.audit.controller = context.getClass().name;
      request.audit.handler = context.getHandler().name;
      request.audit.options =
        this.reflector.getAllAndOverride<AuditRouteOptions>(
          AUDIT_OPTIONS_KEY,
          targets,
        ) ?? {};
    }

    const trackChanges = this.reflector.getAllAndOverride<TrackChangesOptions>(
      TRACK_CHANGES_KEY,
      targets,
    );
    const beforeState = trackChanges
      ? await this.loadBeforeState(request, trackChanges)
      : null;

    return new Observable((subscriber) =>
      this.auditContext.run(() =>
        next.handle().subscribe({
          next: (value) => {
            if (beforeState && trackChanges) {
              this.recordDiff(beforeState, value, trackChanges);
            }
            subscriber.next(value);
          },
          error: (error) => {
            this.syncChanges(request);
            subscriber.error(error);
          },
          complete: () => {
            this.syncChanges(request);
            subscriber.complete();
          },
        }),
      ),
    );
  }

  private loadBeforeState(
    request: FastifyRequest,
    options: TrackChangesOptions,
  ): Promise<Record<string, unknown> | null> {
    const params = (request.params as Record<string, unknown>) ?? {};
    const paramName =
      options.param ??
      (params.code !== undefined
        ? "code"
        : params.id !== undefined
          ? "id"
          : Object.keys(params)[0]);
    if (!paramName) return Promise.resolve(null);

    return this.entitySnapshot.findSnapshot(
      options.model,
      paramName,
      params[paramName],
    );
  }

  private recordDiff(
    beforeState: Record<string, unknown>,
    value: unknown,
    options: TrackChangesOptions,
  ): void {
    // Servisler `HttpSuccess` döner; `ResponseInterceptor` bu interceptor'dan
    // önce çalışmışsa zarf (`{ data }`) gelir. Her iki durumda durum `data`'dadır.
    const afterState =
      value instanceof HttpSuccess
        ? value.data
        : value && typeof value === "object" && "data" in value
          ? (value as { data: unknown }).data
          : value;
    if (!afterState || typeof afterState !== "object") return;

    const diff = calculateDiff(
      beforeState,
      afterState as Record<string, unknown>,
      { exclude: options.exclude ?? ["updatedAt"] },
    );
    if (diff.length > 0) this.auditContext.recordChanges(diff);
  }

  private syncChanges(request: FastifyRequest): void {
    if (!request.audit) return;
    const recorded = this.auditContext.getChanges();
    if (recorded.length > 0) request.audit.changes = recorded;
  }
}
