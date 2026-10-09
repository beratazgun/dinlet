import { Injectable, NotFoundException } from "@nestjs/common";

import { OkResponse } from "#/core/http/index.js";
import { ConsentService } from "#/modules/auth/services/consent.service.js";
import { UsageService } from "#/modules/billing/services/index.js";
import { fluentBlockReason } from "#/modules/billing/utils/index.js";
import {
  DocumentRepository,
  SectionRepository,
} from "#/modules/document/repository/index.js";
import {
  extractFacts,
  isFactCovered,
  type FactKind,
} from "#/modules/document/utils/index.js";
import { RewriteMode } from "#database/enums.js";

/** Listede gösterilecek en fazla eksik bilgi. */
const MAX_MISSING = 50;

/**
 * Kapsam güvencesi: nottaki tarih, sayı ve özel isimlerin anlatımda geçme
 * oranı ve geçmeyenler. Özet değil tam anlatım yapıldığını gösterir.
 */
@Injectable()
export class CoverageService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly usageService: UsageService,
    private readonly consentService: ConsentService,
  ) {}

  async get(documentId: number, userId: number): Promise<OkResponse> {
    const document = await this.documentRepository.findOwned(
      documentId,
      userId,
    );
    if (!document) throw new NotFoundException(`Not bulunamadı: ${documentId}`);

    const sections = await this.sectionRepository.findForCoverage(documentId);
    const kinds: Record<FactKind, { total: number; covered: number }> = {
      date: { total: 0, covered: 0 },
      number: { total: 0, covered: 0 },
      name: { total: 0, covered: 0 },
    };
    const missing: {
      sectionId: number;
      sectionOrder: number;
      sectionTitle: string;
      pageStart: number | null;
      pageEnd: number | null;
      kind: FactKind;
      term: string;
      snippet: string;
    }[] = [];

    for (const section of sections) {
      // Anlatımı olmayan (henüz işlenmemiş) bölüm ölçüme girmez.
      if (!section.script) continue;
      const scriptText = [
        ...section.script.paragraphs,
        section.script.recap ?? "",
      ].join(" ");
      for (const fact of extractFacts(section.sourceText)) {
        kinds[fact.kind].total += 1;
        if (isFactCovered(fact, scriptText)) {
          kinds[fact.kind].covered += 1;
        } else {
          missing.push({
            sectionId: section.id,
            sectionOrder: section.order,
            sectionTitle: section.title,
            pageStart: section.pageStart,
            pageEnd: section.pageEnd,
            ...fact,
          });
        }
      }
    }

    const total = kinds.date.total + kinds.number.total + kinds.name.total;
    const covered =
      kinds.date.covered + kinds.number.covered + kinds.name.covered;
    const canRegenerate =
      document.rewriteMode === RewriteMode.FLUENT &&
      fluentBlockReason(
        await this.usageService.getPlanLimits(userId),
        await this.consentService.hasCrossBorderTransferConsent(userId),
      ) === null;

    return new OkResponse("Kapsam", {
      // Ölçülecek bilgi yoksa eksik de yoktur.
      percent: total > 0 ? Math.floor((covered / total) * 100) : 100,
      total,
      covered,
      kinds,
      missing: missing.slice(0, MAX_MISSING),
      missingCount: missing.length,
      canRegenerate,
    });
  }
}
