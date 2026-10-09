import { Processor } from "@nestjs/bullmq";
import { Logger, type OnModuleDestroy } from "@nestjs/common";
import type { Job } from "bullmq";

import { BatchCollector } from "#/core/utils/index.js";
import {
  AUDIT_LOG_BATCH_SIZE,
  AUDIT_LOG_BATCH_WAIT_MS,
} from "#/infra/audit/queue/audit-log.constants.js";
import { AuditLogRepository } from "#/infra/audit/repository/index.js";
import type { NewAuditLog } from "#/infra/audit/types/index.js";
import { BaseProcessor } from "#/infra/queue/base.processor.js";
import { QueueName } from "#/infra/queue/queue.constants.js";

/**
 * Denetim kuyruğunun WORKER'ı — kayıtları gruplayıp toplu yazar.
 *
 * Worker `AUDIT_LOG_BATCH_SIZE` job'ı eşzamanlı alır; her job kaydını
 * toplayıcıya ekler ve kayıt DB'ye yazılana kadar bekler. Grup dolunca veya
 * `AUDIT_LOG_BATCH_WAIT_MS` dolunca tek bir çok satırlı INSERT atılır.
 * Böylece "yazılmadan tamamlandı" sayılan job olmaz; grup INSERT'i
 * başarısızsa kayıtlar tek tek denenir ve yalnızca bozuk olan retry/DLQ'ya düşer.
 */
@Processor(QueueName.AUDIT_LOG, { concurrency: AUDIT_LOG_BATCH_SIZE })
export class AuditLogProcessor
  extends BaseProcessor<NewAuditLog>
  implements OnModuleDestroy
{
  protected readonly logger = new Logger(AuditLogProcessor.name);
  private readonly collector: BatchCollector<NewAuditLog>;

  constructor(auditLogRepository: AuditLogRepository) {
    super();
    this.collector = new BatchCollector<NewAuditLog>({
      maxSize: AUDIT_LOG_BATCH_SIZE,
      maxWaitMs: AUDIT_LOG_BATCH_WAIT_MS,
      flush: (entries) => auditLogRepository.saveMany(entries),
      flushOne: (entry) => auditLogRepository.save(entry),
    });
  }

  handle(job: Job<NewAuditLog>): Promise<void> {
    return this.collector.add(job.data);
  }

  /** Kapanışta bekleyen grubu yaz; kuyrukta kayıt kaybı olmasın. */
  onModuleDestroy(): Promise<void> {
    return this.collector.flushNow();
  }
}
