import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";
import { DocumentStatus, GenerationStatus } from "#database/enums.js";

/**
 * Mağaza içeriklerinin kullanıcı kütüphanesindeki kopyaları. Kopya kaynak
 * notun bölümlerini, anlatımını, seslerini ve sorularını taşır; kendi
 * tablolarında durduğu için klasör, etiket, dinleme ilerlemesi ve tekrar
 * takvimi kullanıcının kendi notlarındaki gibi çalışır.
 */
@Injectable()
export class StoreLibraryRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /** İçerik → kullanıcının silinmemiş kopyası. */
  async findCopies(
    userId: number,
    itemIds: number[],
  ): Promise<Map<number, number>> {
    const byItem = new Map<number, number>();
    if (itemIds.length === 0) return byItem;
    const rows = await this.db.orm.public.Document.where({ userId })
      .where((document) => document.deletedAt.isNull())
      .where((document) => document.storeItemId.in(itemIds))
      .select("id", "storeItemId")
      .all();
    for (const row of rows) {
      if (row.storeItemId !== null) byItem.set(row.storeItemId, row.id);
    }
    return byItem;
  }

  /**
   * Kaynak notu kopyalar; yeni notun ID'si döner. Kaynak hazır olmalı.
   * `mapKey` verilirse ses anahtarları yeni anahtarlara çevrilir (dosyaları
   * kopyalamak çağıranın işidir); verilmezse kopya kaynağın seslerini paylaşır.
   */
  createCopy(input: {
    userId: number;
    storeItemId: number | null;
    sourceDocumentId: number;
    title: string;
    storagePrefix: string;
    isStoreMaster?: boolean;
    mapKey?: (key: string) => string;
  }): Promise<number> {
    const map = <T extends string | null>(key: T): T =>
      (key && input.mapKey ? input.mapKey(key) : key) as T;
    return this.db.transaction(async (tx) => {
      const source = await tx.orm.public.Document.where({
        id: input.sourceDocumentId,
      })
        .select(
          "pageCount",
          "sourceHash",
          "totalChars",
          "totalDurationMs",
          "extractQuality",
          "rewriteMode",
        )
        .first();
      if (!source) throw new Error(`Kaynak not yok: ${input.sourceDocumentId}`);

      const copy = await tx.orm.public.Document.select("id").create({
        userId: input.userId,
        mediaId: null,
        storeItemId: input.storeItemId,
        isStoreMaster: input.isStoreMaster ?? false,
        title: input.title,
        status: DocumentStatus.READY,
        storagePrefix: input.storagePrefix,
        ...source,
      });

      const sections = await tx.orm.public.Section.where({
        documentId: input.sourceDocumentId,
      })
        .select(
          "id",
          "order",
          "title",
          "pageStart",
          "pageEnd",
          "sourceText",
          "charCount",
          "script",
          "scriptHash",
          "status",
          "audioKey",
          "durationMs",
          "sizeBytes",
          "recapAudioKey",
          "recapDurationMs",
          "quickStatus",
          "quickScript",
          "quickScriptHash",
          "quickAudioKey",
          "quickDurationMs",
          "model",
          "promptVersion",
        )
        .orderBy((section) => section.order.asc())
        .all();

      for (const { id: sourceSectionId, quickStatus, ...section } of sections) {
        // Hızlı tekrar yalnızca hazırsa taşınır; yarım üretim kopyada başlamaz.
        const quickReady = quickStatus === GenerationStatus.READY;
        const created = await tx.orm.public.Section.select("id").create({
          ...section,
          documentId: copy.id,
          audioKey: map(section.audioKey),
          recapAudioKey: map(section.recapAudioKey),
          quickStatus: quickReady ? quickStatus : null,
          quickScript: quickReady ? section.quickScript : null,
          quickScriptHash: quickReady ? section.quickScriptHash : null,
          quickAudioKey: quickReady ? map(section.quickAudioKey) : null,
          quickDurationMs: quickReady ? section.quickDurationMs : null,
        });

        const questions = await tx.orm.public.QuizQuestion.where({
          sectionId: sourceSectionId,
        })
          .select(
            "order",
            "question",
            "answer",
            "detail",
            "questionAudioKey",
            "questionDurationMs",
            "answerAudioKey",
            "answerDurationMs",
          )
          .all();
        if (questions.length > 0) {
          await tx.orm.public.QuizQuestion.createAll(
            questions.map((question) => ({
              ...question,
              questionAudioKey: map(question.questionAudioKey),
              answerAudioKey: map(question.answerAudioKey),
              sectionId: created.id,
            })),
          );
        }
      }
      return copy.id;
    });
  }
}
