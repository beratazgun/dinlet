import { Module } from "@nestjs/common";
import { JobService } from "#/infra/job/job.service.js";
import { JobRepository } from "#/infra/job/repository/job.repository.js";
import { JobController } from "#/infra/job/job.controller.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { AbstractJobHandler } from "#/infra/job/handlers/abstract.handler.js";
import { AuditLogCleanupHandler } from "#/infra/job/handlers/audit-log-cleanup.handler.js";
import { DataPurgeHandler } from "#/infra/job/handlers/data-purge.handler.js";
import { DocumentPipelineReconcileHandler } from "#/infra/job/handlers/document-pipeline-reconcile.handler.js";
import { QueueHealthAlertHandler } from "#/infra/job/handlers/queue-health-alert.handler.js";
import { AuthModule } from "#/modules/auth/auth.module.js";
import { DocumentModule } from "#/modules/document/document.module.js";
import { JobSchedulerService, JobExecutorService } from "#/infra/job/services/index.js";

/**
 * Job scheduler modülü.
 * @nestjs/schedule ile zamanlama ve Prisma Job tablosu ile
 * iş mantığı yönetimini sağlar.
 */
@Module({
  imports: [DocumentModule, AuthModule],
  providers: [
    JobSchedulerService,
    JobExecutorService,
    JobService,
    JobRepository,
    DateManager,
    AuditLogCleanupHandler,
    DocumentPipelineReconcileHandler,
    DataPurgeHandler,
    QueueHealthAlertHandler,
    // Handler'ları bir array olarak inject etmek için factory provider.
    // Yeni handler eklerken: provider listesine + useFactory dönüş array'ine ekle.
    {
      provide: "JOB_HANDLERS",
      useFactory: (
        auditLogCleanup: AuditLogCleanupHandler,
        documentPipelineReconcile: DocumentPipelineReconcileHandler,
        dataPurge: DataPurgeHandler,
        queueHealthAlert: QueueHealthAlertHandler,
      ): AbstractJobHandler[] => [
        auditLogCleanup,
        documentPipelineReconcile,
        dataPurge,
        queueHealthAlert,
      ],
      inject: [
        AuditLogCleanupHandler,
        DocumentPipelineReconcileHandler,
        DataPurgeHandler,
        QueueHealthAlertHandler,
      ],
    },
  ],
  controllers: [JobController],
  exports: [JobSchedulerService, JobExecutorService, JobService],
})
export class JobModule {}
