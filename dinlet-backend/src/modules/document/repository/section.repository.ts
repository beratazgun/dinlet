import { Injectable } from "@nestjs/common";
import type { JsonValue } from "@prisma/orm-postgres/target/codec-types";

import type { SectionScript } from "#/modules/document/types/index.js";
import { DatabaseService } from "#database/database.service.js";
import {
  GenerationStatus,
  RecordingStatus,
  VoicePreference,
  SectionStatus as SectionStatusValues,
  type SectionStatus,
} from "#database/enums.js";

const SUMMARY_FIELDS = [
  "id",
  "documentId",
  "order",
  "title",
  "status",
  "charCount",
  "durationMs",
  "audioKey",
  "recapDurationMs",
  "quickStatus",
  "quickDurationMs",
  "quickAudioKey",
] as const;

export interface NewSection {
  order: number;
  title: string;
  sourceText: string;
  charCount: number;
}

export interface SectionPatch {
  status?: SectionStatus;
  script?: SectionScript | null;
  scriptHash?: string | null;
  charCount?: number;
  audioKey?: string | null;
  durationMs?: number | null;
  sizeBytes?: number | null;
  model?: string | null;
  promptVersion?: string | null;
  attempts?: number;
  failureReason?: string | null;
}

/** Hızlı tekrar alanları (bölüm sesinden bağımsız ilerler). */
export interface QuickPatch {
  quickStatus?: GenerationStatus | null;
  quickScript?: SectionScript | null;
  quickScriptHash?: string | null;
  quickAudioKey?: string | null;
  quickDurationMs?: number | null;
}

/** Bir belgenin seslendirilecek bölümleri. */
@Injectable()
export class SectionRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /** Bölümleri ve belgenin toplam karakterini tek transaction'da yazar. */
  createForDocument(documentId: number, sections: NewSection[]) {
    const totalChars = sections.reduce((sum, s) => sum + s.charCount, 0);
    return this.db.transaction(async (tx) => {
      await tx.orm.public.Section.createAll(
        sections.map((section) => ({ ...section, documentId })),
      );
      await tx.orm.public.Document.where({ id: documentId }).updateAndCount({
        totalChars,
      });
    });
  }

  /** Liste görünümü için birden çok belgenin bölüm durumları (tek sorgu). */
  findStatesByDocuments(documentIds: number[]) {
    if (documentIds.length === 0) return Promise.resolve([]);
    return this.db.orm.public.Section.where((section) =>
      section.documentId.in(documentIds),
    )
      .select("id", "documentId", "status", "charCount")
      .all();
  }

  /**
   * Kullanıcının bu bölümde çalacak kendi ses kaydı: kayıt hazır, bölümde
   * kendi sesi seçili, genel tercih "Benim sesim" ve anlatım kayıttan beri
   * değişmemiş. Aksi hâlde `null` (Dinlet sesi çalar).
   */
  async findOwnVoice(userId: number, sectionId: number, scriptHash: string | null) {
    const [recording, setting] = await Promise.all([
      this.db.orm.public.SectionRecording.where({ userId, sectionId })
        .where((row) => row.status.eq(RecordingStatus.READY))
        .select(
          "scriptHash",
          "useOwnVoice",
          "audioKey",
          "durationMs",
          "recapStartMs",
          "recapDurationMs",
        )
        .first(),
      this.db.orm.public.VoiceSetting.where({ userId }).select("voice").first(),
    ]);
    if (
      !recording?.audioKey ||
      !recording.useOwnVoice ||
      setting?.voice !== VoicePreference.OWN ||
      recording.scriptHash !== (scriptHash ?? "")
    ) {
      return null;
    }
    return recording;
  }

  /** Bölüm sonu soruları (oynatıcıda "Bölüm sonu soruları" açıkken). */
  findQuizQuestions(sectionId: number) {
    return this.db.orm.public.QuizQuestion.where({ sectionId })
      .select(
        "id",
        "order",
        "question",
        "answer",
        "detail",
        "questionAudioKey",
        "questionDurationMs",
        "answerAudioKey",
        "answerDurationMs",
      )
      .orderBy((question) => question.order.asc())
      .all();
  }

  /** Kapsam kontrolü için bölümlerin kaynak metni ve anlatımı. */
  async findForCoverage(documentId: number) {
    const rows = await this.db.orm.public.Section.where({ documentId })
      .select("id", "order", "title", "pageStart", "pageEnd", "status", "sourceText", "script")
      .orderBy((section) => section.order.asc())
      .all();
    return rows.map((row) => ({ ...row, script: row.script as SectionScript | null }));
  }

  findSummariesByDocument(documentId: number) {
    return this.db.orm.public.Section.where({ documentId })
      .select(...SUMMARY_FIELDS)
      .orderBy((section) => section.order.asc())
      .all();
  }

  /** İşleme hattı için bölümler (ham metin ve script dahil). */
  async findForProcessing(documentId: number) {
    const rows = await this.db.orm.public.Section.where({ documentId })
      .select(
        "id",
        "order",
        "title",
        "status",
        "sourceText",
        "script",
        "scriptHash",
        "attempts",
      )
      .orderBy((section) => section.order.asc())
      .all();
    return rows.map((row) => ({
      ...row,
      script: row.script as SectionScript | null,
    }));
  }

  /** Bölüm + sahiplik/işleme için belge alanları. */
  async findWithDocument(id: number) {
    const row = await this.db.orm.public.Section.where({ id })
      .select(
        ...SUMMARY_FIELDS,
        "script",
        "scriptHash",
        "sourceText",
        "attempts",
        "failureReason",
        "sizeBytes",
        "createdAt",
        "updatedAt",
      )
      .include("document", (document) =>
        document.select(
          "id",
          "userId",
          "title",
          "status",
          "storagePrefix",
          "rewriteMode",
          "storeItemId",
          "deletedAt",
        ),
      )
      .first();
    return row ? { ...row, script: row.script as SectionScript | null } : null;
  }

  async update(id: number, patch: SectionPatch): Promise<void> {
    await this.db.orm.public.Section.where({ id }).updateAndCount(
      this.toRow(patch),
    );
  }

  /** Bölüm beklenen durumdaysa günceller; değiştiyse `true`. */
  /**
   * Aralıklı tekrar sesleri: özet klibi bölüme, sorular `quiz_questions`'a.
   * Bölüm yeniden seslendirildiyse eski sorular yenileriyle değişir.
   */
  saveStudyClips(
    sectionId: number,
    recap: { audioKey: string; durationMs: number } | null,
    questions: {
      order: number;
      question: string;
      answer: string;
      detail: string;
      questionAudioKey: string;
      questionDurationMs: number;
      answerAudioKey: string;
      answerDurationMs: number;
    }[],
  ): Promise<void> {
    return this.db.transaction(async (tx) => {
      await tx.orm.public.Section.where({ id: sectionId }).updateAndCount({
        recapAudioKey: recap?.audioKey ?? null,
        recapDurationMs: recap?.durationMs ?? null,
      });
      await tx.orm.public.QuizQuestion.where({ sectionId }).deleteAndCount();
      if (questions.length > 0) {
        await tx.orm.public.QuizQuestion.createAll(
          questions.map((question) => ({ sectionId, ...question })),
        );
      }
    });
  }

  async transition(
    id: number,
    from: SectionStatus[],
    patch: SectionPatch & { status: SectionStatus },
  ): Promise<boolean> {
    const updated = await this.db.orm.public.Section.where({ id })
      .where((section) => section.status.in(from))
      .updateAndCount(this.toRow(patch));
    return updated > 0;
  }

  /** Verilen durumda `olderThan`'dan beri güncellenmemiş bölümler. */
  findStale(status: SectionStatus, olderThan: string, limit: number) {
    return this.db.orm.public.Section.where({ status })
      .where((section) => section.updatedAt.lt(olderThan))
      .select("id", "scriptHash", "attempts")
      .orderBy((section) => section.updatedAt.asc())
      .limit(limit)
      .all();
  }

  /** Hızlı tekrar için bölümler (asıl anlatımı ve hızlı sürümüyle). */
  async findForQuick(documentId: number) {
    const rows = await this.db.orm.public.Section.where({ documentId })
      .select(
        "id",
        "order",
        "title",
        "status",
        "script",
        "attempts",
        "quickStatus",
        "quickScript",
        "quickScriptHash",
      )
      .orderBy((section) => section.order.asc())
      .all();
    return rows.map((row) => ({
      ...row,
      script: row.script as SectionScript | null,
      quickScript: row.quickScript as SectionScript | null,
    }));
  }

  /**
   * Sesi hazır olup hızlı sürümü olmayan (veya başarısız olan) bölümleri
   * hızlı tekrara alır; kaç bölüm alındığını döner.
   */
  async markQuickPending(documentId: number): Promise<number> {
    const ready = this.db.orm.public.Section.where({
      documentId,
      status: SectionStatusValues.READY,
    });
    const fresh = await ready
      .where((section) => section.quickStatus.isNull())
      .updateAndCount({ quickStatus: GenerationStatus.PENDING });
    const retried = await this.db.orm.public.Section.where({
      documentId,
      status: SectionStatusValues.READY,
      quickStatus: GenerationStatus.FAILED,
    }).updateAndCount({
      quickStatus: GenerationStatus.PENDING,
      quickScript: null,
      quickScriptHash: null,
    });
    return fresh + retried;
  }

  async updateQuick(id: number, patch: QuickPatch): Promise<void> {
    const { quickScript, ...rest } = patch;
    await this.db.orm.public.Section.where({ id }).updateAndCount(
      quickScript === undefined
        ? rest
        : { ...rest, quickScript: quickScript as unknown as JsonValue },
    );
  }

  private toRow(patch: SectionPatch) {
    const { script, ...rest } = patch;
    return script === undefined
      ? rest
      : { ...rest, script: script as unknown as JsonValue };
  }
}
