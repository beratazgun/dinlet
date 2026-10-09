import { Injectable } from "@nestjs/common";

import type {
  AbstractJobHandler,
  JobExecutionResult,
  JobParams,
} from "#/infra/job/handlers/abstract.handler.js";
import { UserPurgeService } from "#/modules/auth/services/index.js";
import { DocumentPurgeService } from "#/modules/document/services/index.js";

const DEFAULT_GRACE_DAYS = 3;

/**
 * Silinen not ve hesapları kalıcı siler (R2 dosyaları + kayıtlar).
 * `params.graceDays` (varsayılan 3) yanlışlıkla silmeye karşı bekleme
 * süresidir; doküman en geç 7 gün içinde kalıcı silmeyi şart koşar.
 */
@Injectable()
export class DataPurgeHandler implements AbstractJobHandler {
  constructor(
    private readonly documentPurge: DocumentPurgeService,
    private readonly userPurge: UserPurgeService,
  ) {}

  getJobCode(): string {
    return "DATA_PURGE";
  }

  async execute(params: JobParams = {}): Promise<JobExecutionResult> {
    const graceDays =
      typeof params.graceDays === "number" && params.graceDays >= 0
        ? Math.min(params.graceDays, 7)
        : DEFAULT_GRACE_DAYS;
    const documents = await this.documentPurge.purgeDeleted(graceDays);
    const users = await this.userPurge.purgeDeleted(graceDays);
    return { affectedRows: documents + users, metadata: { documents, users, graceDays } };
  }
}
