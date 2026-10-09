import { Injectable } from "@nestjs/common";

import type {
  AbstractJobHandler,
  JobExecutionResult,
  JobParams,
} from "#/infra/job/handlers/abstract.handler.js";
import { DocumentReconcileService } from "#/modules/document/services/index.js";

/**
 * Kuyruk olayları kaçtığı için takılı kalan belge/bölümleri onarır.
 * Eşik `params.staleMinutes` ile redeploy'suz değiştirilir (varsayılan 15).
 */
@Injectable()
export class DocumentPipelineReconcileHandler implements AbstractJobHandler {
  constructor(private readonly reconcileService: DocumentReconcileService) {}

  getJobCode(): string {
    return "DOCUMENT_PIPELINE_RECONCILE";
  }

  async execute(params: JobParams = {}): Promise<JobExecutionResult> {
    const staleMinutes =
      typeof params.staleMinutes === "number" && params.staleMinutes > 0
        ? params.staleMinutes
        : undefined;
    const summary = await this.reconcileService.reconcile(staleMinutes);
    return {
      affectedRows: summary.recovered,
      metadata: { checked: summary.checked },
    };
  }
}
