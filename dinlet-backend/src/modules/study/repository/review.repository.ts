import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";

export interface ReviewSectionInfo {
  id: number;
  order: number;
  title: string;
  recapAudioKey: string | null;
  recapDurationMs: number | null;
  documentId: number;
  documentTitle: string;
}

export interface ReviewQuestionRow {
  id: number;
  sectionId: number;
  order: number;
  question: string;
  answer: string;
  detail: string;
  questionAudioKey: string;
  questionDurationMs: number;
  answerAudioKey: string;
  answerDurationMs: number;
}

/** Aralıklı tekrar kalemleri, tekrar günleri ve bölüm soruları. */
@Injectable()
export class ReviewRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /** Bölümün sorusu var mı (yalnızca sorulu bölümler tekrara girer)? */
  async countQuestions(sectionId: number): Promise<number> {
    const { total } = await this.db.orm.public.QuizQuestion.where({
      sectionId,
    }).aggregate((aggregate) => ({ total: aggregate.count() }));
    return total;
  }

  /** Bölümü tekrara ekler; zaten varsa olduğu gibi bırakır. */
  async enroll(
    userId: number,
    sectionId: number,
    dueOn: string,
  ): Promise<void> {
    const existing = await this.findItem(userId, sectionId);
    if (existing) return;
    await this.db.orm.public.ReviewItem.upsert({
      create: { userId, sectionId, dueOn },
      update: { sectionId },
      conflictOn: { userId, sectionId },
    });
  }

  findItem(userId: number, sectionId: number) {
    return this.db.orm.public.ReviewItem.where({ userId, sectionId })
      .select("id", "stage", "dueOn", "graduated", "lastReviewedOn")
      .first();
  }

  /** Bitmemiş tekrar kalemleri, sıradaki güne göre. */
  listActive(userId: number) {
    return this.db.orm.public.ReviewItem.where({ userId, graduated: false })
      .select("id", "sectionId", "stage", "dueOn")
      .orderBy([(item) => item.dueOn.asc(), (item) => item.id.asc()])
      .all();
  }

  async updateItem(
    id: number,
    patch: {
      stage: number;
      dueOn: string;
      graduated: boolean;
      lastReviewedOn: string;
    },
  ): Promise<void> {
    await this.db.orm.public.ReviewItem.where({ id }).updateAndCount(patch);
  }

  /** Bölümlerin başlıkları ve notları; silinmiş notunkiler dönmez. */
  async findSections(
    sectionIds: number[],
  ): Promise<Map<number, ReviewSectionInfo>> {
    const result = new Map<number, ReviewSectionInfo>();
    if (sectionIds.length === 0) return result;
    const sections = await this.db.orm.public.Section.where((section) =>
      section.id.in(sectionIds),
    )
      .select(
        "id",
        "order",
        "title",
        "documentId",
        "recapAudioKey",
        "recapDurationMs",
      )
      .all();
    if (sections.length === 0) return result;

    const documents = await this.db.orm.public.Document.where((document) =>
      document.id.in([
        ...new Set(sections.map((section) => section.documentId)),
      ]),
    )
      .where((document) => document.deletedAt.isNull())
      .select("id", "title")
      .all();
    const titles = new Map(
      documents.map((document) => [document.id, document.title]),
    );

    for (const section of sections) {
      const documentTitle = titles.get(section.documentId);
      if (documentTitle === undefined) continue;
      result.set(section.id, { ...section, documentTitle });
    }
    return result;
  }

  async findQuestions(
    sectionIds: number[],
  ): Promise<Map<number, ReviewQuestionRow[]>> {
    const bySection = new Map<number, ReviewQuestionRow[]>();
    if (sectionIds.length === 0) return bySection;
    const rows = await this.db.orm.public.QuizQuestion.where((question) =>
      question.sectionId.in(sectionIds),
    )
      .select(
        "id",
        "sectionId",
        "order",
        "question",
        "answer",
        "detail",
        "questionAudioKey",
        "questionDurationMs",
        "answerAudioKey",
        "answerDurationMs",
      )
      .orderBy([(question) => question.order.asc()])
      .all();
    for (const row of rows) {
      const list = bySection.get(row.sectionId) ?? [];
      list.push(row);
      bySection.set(row.sectionId, list);
    }
    return bySection;
  }

  /** Bugün tekrar yapıldığını işler (haftalık şerit ve seri için). */
  async markDay(userId: number, day: string): Promise<void> {
    const existing = await this.db.orm.public.ReviewDay.where({ userId, day })
      .select("id", "reviewedSections")
      .first();
    if (existing) {
      await this.db.orm.public.ReviewDay.where({
        id: existing.id,
      }).updateAndCount({
        reviewedSections: existing.reviewedSections + 1,
      });
      return;
    }
    await this.db.orm.public.ReviewDay.upsert({
      create: { userId, day, reviewedSections: 1 },
      update: { day },
      conflictOn: { userId, day },
    });
  }

  /** `since` gününden (dahil) bu yana tekrar yapılan günler. */
  async listDays(userId: number, since: string): Promise<string[]> {
    const rows = await this.db.orm.public.ReviewDay.where({ userId })
      .where((row) => row.day.gte(since))
      .select("day")
      .all();
    return rows.map((row) => row.day);
  }
}
