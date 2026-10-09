import {
  autoIncrementId,
  type ModelHelpers,
} from "#database/models/model.types.js";

/**
 * Çalışma araçları: klasörler, etiketler ve sınav hedefi. Belgenin klasörü
 * ve favori bilgisi `documents` tablosundadır.
 */
export function createStudyModels({ field, model }: ModelHelpers) {
  const Folder = model("Folder", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      name: field.text(),
      /** Uygulamadaki renk paletinden bir değer (`#1928B4` gibi). */
      color: field.text(),
      /** Kullanıcının belirlediği sıra; küçük önce. */
      position: field.int().default(0),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.userId, fields.name])],
    }))
    .sql(({ cols, constraints }) => ({
      table: "folders",
      indexes: [constraints.index([cols.userId, cols.position])],
    }));

  const Tag = model("Tag", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      name: field.text(),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.userId, fields.name])],
    }))
    .sql(() => ({ table: "tags" }));

  const DocumentTag = model("DocumentTag", {
    fields: {
      id: autoIncrementId(field),
      documentId: field.int().column("document_id"),
      tagId: field.int().column("tag_id"),
      createdAt: field.temporal.createdAtString().column("created_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.documentId, fields.tagId])],
    }))
    .sql(({ cols, constraints }) => ({
      table: "document_tags",
      indexes: [constraints.index([cols.tagId])],
    }));

  /** Kullanıcı başına tek sınav hedefi ("KPSS hedefi · 38 gün kaldı"). */
  const StudyGoal = model("StudyGoal", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      examName: field.text().column("exam_name"),
      /** Sınav günü, `YYYY-MM-DD` (saat dilimsiz takvim günü). */
      examDate: field.text().column("exam_date"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.userId])],
    }))
    .sql(() => ({ table: "study_goals" }));

  /**
   * Aralıklı tekrar: dinlenip bitirilen ve sorusu olan bölüm. `stage`
   * 0→1→2→3 sırasıyla 1, 3, 7 ve 21 gün sonra tekrar edilir; bilinemezse
   * ertesi güne ve başa döner.
   */
  const ReviewItem = model("ReviewItem", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      sectionId: field.int().column("section_id"),
      stage: field.int().default(0),
      /** Sıradaki tekrar günü (`YYYY-MM-DD`, Türkiye takvimi). */
      dueOn: field.text().column("due_on"),
      /** Son aşama da bilindiyse tekrar biter. */
      graduated: field.boolean().default(false),
      lastReviewedOn: field.text().optional().column("last_reviewed_on"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.userId, fields.sectionId])],
    }))
    .sql(({ cols, constraints }) => ({
      table: "review_items",
      indexes: [constraints.index([cols.userId, cols.graduated, cols.dueOn])],
    }));

  /** Tekrar yapılan günler: haftalık şerit ve "5 gündür aralıksız" serisi. */
  const ReviewDay = model("ReviewDay", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      day: field.text(),
      reviewedSections: field.int().default(0).column("reviewed_sections"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.userId, fields.day])],
    }))
    .sql(() => ({ table: "review_days" }));

  return { Folder, Tag, DocumentTag, StudyGoal, ReviewItem, ReviewDay };
}
