import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { DateManager } from "#/core/utils/date-manager.js";
import { Paginator } from "#/core/utils/paginator.js";
import { AuditLogController } from "#/infra/audit/audit-log.controller.js";
import { AuditHttpHook } from "#/infra/audit/hooks/audit-http.hook.js";
import { AuditContextInterceptor } from "#/infra/audit/interceptors/audit-context.interceptor.js";
import {
  AuditLogProcessor,
  AuditLogQueueService,
} from "#/infra/audit/queue/index.js";
import { AuditRepositories } from "#/infra/audit/repository/index.js";
import {
  AuditContextService,
  AuditServices,
} from "#/infra/audit/services/index.js";
import { QueueName } from "#/infra/queue/queue.constants.js";

/**
 * HTTP denetim kaydı (audit trail).
 *
 * İstek → `AuditHttpHook` (Fastify hook'ları) → `AuditRecorderService`
 * (redaksiyon + kırpma) → `AuditLogQueueService` (BullMQ) → `AuditLogProcessor`
 * → `audit_logs` tablosu. İstek yolu DB'yi beklemez.
 *
 * Hook'lar `main.ts`'te `app.get(AuditHttpHook).register(...)` ile bağlanır.
 * Eski kayıtları `AUDIT_LOG_CLEANUP` job'ı temizler (job modülü).
 * Global'dir: servisler değişiklik kaydı için `AuditContextService` enjekte edebilir.
 */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QueueName.AUDIT_LOG })],
  controllers: [AuditLogController],
  providers: [
    ...AuditRepositories,
    ...AuditServices,
    AuditLogQueueService,
    AuditLogProcessor,
    AuditHttpHook,
    DateManager,
    Paginator,
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
  ],
  exports: [AuditContextService],
})
export class AuditModule {}
