import { Injectable } from "@nestjs/common";

import type { StudySectionRow } from "#/modules/study/utils/index.js";
import { DatabaseService } from "#database/database.service.js";

/**
 * Klasör ve hedef ilerlemesi için kullanıcının notları, bölümleri ve dinleme
 * kayıtları. Belge modülüne bağımlı olmamak için tablolara doğrudan bakar.
 */
@Injectable()
export class StudyProgressRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /** Kullanıcının silinmemiş notları. */
  findDocuments(userId: number) {
    return this.db.orm.public.Document.where({ userId, isStoreMaster: false })
      .where((document) => document.deletedAt.isNull())
      .select("id", "status", "folderId", "isFavorite", "createdAt")
      .all();
  }

  /** Notların bölümleri, kullanıcının dinleme durumuyla birlikte. */
  async findSectionRows(
    userId: number,
    documentIds: number[],
  ): Promise<Map<number, StudySectionRow[]>> {
    const byDocument = new Map<number, StudySectionRow[]>();
    if (documentIds.length === 0) return byDocument;

    const sections = await this.db.orm.public.Section.where((section) =>
      section.documentId.in(documentIds),
    )
      .select("id", "documentId", "status", "durationMs", "charCount")
      .all();
    if (sections.length === 0) return byDocument;

    const progress = await this.db.orm.public.PlaybackProgress.where({ userId })
      .where((row) => row.sectionId.in(sections.map((section) => section.id)))
      .select("sectionId", "positionMs", "completed")
      .all();
    const progressBySection = new Map(
      progress.map((row) => [row.sectionId, row]),
    );

    for (const section of sections) {
      const listened = progressBySection.get(section.id);
      const list = byDocument.get(section.documentId) ?? [];
      list.push({
        status: section.status,
        durationMs: section.durationMs,
        charCount: section.charCount,
        completed: listened?.completed ?? false,
        positionMs: listened?.positionMs ?? 0,
      });
      byDocument.set(section.documentId, list);
    }
    return byDocument;
  }

  /** Belge kullanıcıya ait ve silinmemiş mi? */
  async ownsDocument(userId: number, documentId: number): Promise<boolean> {
    const row = await this.db.orm.public.Document.where({
      id: documentId,
      userId,
    })
      .where((document) => document.deletedAt.isNull())
      .select("id")
      .first();
    return row !== null;
  }
}
