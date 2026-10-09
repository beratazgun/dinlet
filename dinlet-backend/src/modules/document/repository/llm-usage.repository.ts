import { Injectable } from "@nestjs/common";

import type { LlmCallUsage } from "#/infra/llm/index.js";
import { DatabaseService } from "#database/database.service.js";

/** Her LLM çağrısının token kullanımı ve maliyeti (`llm_usage`). */
@Injectable()
export class LlmUsageRepository {
  constructor(private readonly database: DatabaseService) {}

  async record(
    usage: LlmCallUsage,
    /** Belge düzeyindeki çağrılarda (hafıza kancaları) bölüm yoktur. */
    target: { documentId: number; sectionId: number | null },
  ): Promise<void> {
    await this.database.client.orm.public.LlmUsage.create({
      documentId: target.documentId,
      sectionId: target.sectionId,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      costUsd: usage.costUsd.toFixed(6),
    });
  }
}
