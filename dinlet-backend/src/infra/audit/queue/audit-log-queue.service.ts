import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { AuditLogJobName } from "#/infra/audit/queue/audit-log.constants.js";
import type { NewAuditLog } from "#/infra/audit/types/index.js";
import { QueueName } from "#/infra/queue/queue.constants.js";

/**
 * Denetim kuyruğunun PRODUCER'ı. Kaydı request dışında, retry garantisiyle
 * kalıcılaştırılmak üzere kuyruğa alır; istek yolu DB yazımını beklemez.
 */
@Injectable()
export class AuditLogQueueService {
  constructor(
    @InjectQueue(QueueName.AUDIT_LOG)
    private readonly queue: Queue<NewAuditLog>,
  ) {}

  async enqueue(entry: NewAuditLog): Promise<void> {
    await this.queue.add(AuditLogJobName.STORE, entry, {
      // Aynı istek iki kez kuyruğa girerse tek kayıt oluşsun.
      jobId: `audit-${entry.requestId}`,
    });
  }
}
