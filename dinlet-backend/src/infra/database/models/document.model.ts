import { enumType, member } from "@prisma/orm-postgres/contract-builder";
import {
  autoIncrementId,
  type ModelHelpers,
} from "#database/models/model.types.js";

const pgText = { codecId: "pg/text@1", nativeType: "text" } as const;

/**
 * Belgenin işleme durumu:
 * `QUEUED` → `EXTRACTING` → `SCRIPTING` → `SYNTHESIZING` → `READY`.
 * Her adımdan `FAILED`'a geçilebilir. En az bir bölüm hazır ama biri kalıcı
 * başarısızsa `PARTIAL`; yeniden deneme başarılı olursa `PARTIAL` → `READY`.
 */
export const DocumentStatus = enumType(
  "DocumentStatus",
  pgText,
  member("QUEUED"),
  member("EXTRACTING"),
  member("SCRIPTING"),
  member("SYNTHESIZING"),
  member("READY"),
  member("PARTIAL"),
  member("FAILED"),
);

/**
 * Bölümün durumu: `PENDING` → `SCRIPTING` → `SCRIPTED` → `SYNTHESIZING` →
 * `READY`. Her adımdan `FAILED`; yeniden deneme `FAILED` → `PENDING`.
 */
export const SectionStatus = enumType(
  "SectionStatus",
  pgText,
  member("PENDING"),
  member("SCRIPTING"),
  member("SCRIPTED"),
  member("SYNTHESIZING"),
  member("READY"),
  member("FAILED"),
);

/** Metin çıkarma kalitesi; OCR'lanan sayfa oranı yüksekse `LOW`. */
export const ExtractQuality = enumType(
  "ExtractQuality",
  pgText,
  member("OK"),
  member("LOW"),
);

/** Free = `RAW` (kural tabanlı temizlik), Pro = `FLUENT` (LLM ile anlatım). */
export const RewriteMode = enumType(
  "RewriteMode",
  pgText,
  member("RAW"),
  member("FLUENT"),
);

/**
 * İsteğe bağlı üretimlerin durumu (hızlı tekrar sesi, hafıza kancaları):
 * istendi → hazır ya da başarısız. Hiç istenmediyse alan boştur.
 */
export const GenerationStatus = enumType(
  "GenerationStatus",
  pgText,
  member("PENDING"),
  member("READY"),
  member("FAILED"),
);

export const documentEnums = {
  DocumentStatus,
  SectionStatus,
  ExtractQuality,
  RewriteMode,
  GenerationStatus,
};

export function createDocumentModels({ field, model }: ModelHelpers) {
  const Document = model("Document", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      /** Yüklenen PDF; mağazadan eklenen kopyada yok. */
      mediaId: field.int().optional().column("media_id"),
      title: field.text(),
      status: field
        .namedType(DocumentStatus)
        .default(DocumentStatus.members.QUEUED),
      pageCount: field.int().column("page_count"),
      /** PDF'in SHA-256 özeti; aynı kullanıcı aynı PDF'i tekrar yüklerse kullanılır. */
      sourceHash: field.text().column("source_hash"),
      /** Ses dosyalarının R2 anahtarlarına eklenen tahmin edilemez önek. */
      storagePrefix: field.text().column("storage_prefix"),
      totalChars: field.int().default(0).column("total_chars"),
      totalDurationMs: field.int().optional().column("total_duration_ms"),
      failureReason: field.text().optional().column("failure_reason"),
      extractedKey: field.text().optional().column("extracted_key"),
      extractQuality: field
        .namedType(ExtractQuality)
        .optional()
        .column("extract_quality"),
      rewriteMode: field.namedType(RewriteMode).column("rewrite_mode"),
      /** Kullanıcının klasörü; klasör silinirse not klasörsüz kalır. */
      folderId: field.int().optional().column("folder_id"),
      isFavorite: field.boolean().default(false).column("is_favorite"),
      /**
       * Mağazadan eklenen kopyanın içeriği. Kopyanın bölüm sesleri kaynak
       * notun dosyalarıdır; kopya silinince yalnızca kendi önekindeki
       * dosyalar (hızlı tekrar, kanca sesleri) temizlenir.
       */
      storeItemId: field.int().optional().column("store_item_id"),
      /**
       * Mağazadaki topluluk notunun kaynağı: onay anında yazarın notundan
       * kopyalanır, onaylayan editöre aittir ve kimsenin kütüphanesinde görünmez.
       */
      isStoreMaster: field.boolean().default(false).column("is_store_master"),
      /** Hafıza kancası önerilerinin üretim durumu. */
      mnemonicStatus: field
        .namedType(GenerationStatus)
        .optional()
        .column("mnemonic_status"),
      deletedAt: field.temporal
        .timestamptzString()
        .optional()
        .column("deleted_at"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "documents",
    indexes: [
      // Silinen belge aynı PDF'le yeniden yüklenebilsin diye unique değil;
      // tekillik servis katmanında silinmemiş kayıtlar arasında aranır.
      constraints.index([cols.userId, cols.sourceHash]),
      constraints.index([cols.userId, cols.createdAt]),
      constraints.index([cols.status]),
      constraints.index([cols.mediaId]),
      constraints.index([cols.folderId]),
      constraints.index([cols.userId, cols.storeItemId]),
    ],
  }));

  const Section = model("Section", {
    fields: {
      id: autoIncrementId(field),
      documentId: field.int().column("document_id"),
      order: field.int(),
      title: field.text(),
      pageStart: field.int().optional().column("page_start"),
      pageEnd: field.int().optional().column("page_end"),
      /** Docling Markdown'ından bölümün ham metni. */
      sourceText: field.text().column("source_text"),
      charCount: field.int().column("char_count"),
      /** Seslendirilecek metin: `{ paragraphs: string[], recap: string | null }`. */
      script: field.json().optional(),
      scriptHash: field.text().optional().column("script_hash"),
      status: field
        .namedType(SectionStatus)
        .default(SectionStatus.members.PENDING),
      audioKey: field.text().optional().column("audio_key"),
      durationMs: field.int().optional().column("duration_ms"),
      sizeBytes: field.int().optional().column("size_bytes"),
      /** Tekrar özetinin ayrı sesi (aralıklı tekrarda yalnızca özet çalar). */
      recapAudioKey: field.text().optional().column("recap_audio_key"),
      recapDurationMs: field.int().optional().column("recap_duration_ms"),
      /** Hızlı tekrar: yalnızca ana bilgiler, kısa cümleler (istek üzerine). */
      quickStatus: field
        .namedType(GenerationStatus)
        .optional()
        .column("quick_status"),
      quickScript: field.json().optional().column("quick_script"),
      quickScriptHash: field.text().optional().column("quick_script_hash"),
      quickAudioKey: field.text().optional().column("quick_audio_key"),
      quickDurationMs: field.int().optional().column("quick_duration_ms"),
      model: field.text().optional(),
      promptVersion: field.text().optional().column("prompt_version"),
      attempts: field.int().default(0),
      failureReason: field.text().optional().column("failure_reason"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.documentId, fields.order])],
    }))
    .sql(({ cols, constraints }) => ({
      table: "sections",
      indexes: [constraints.index([cols.documentId, cols.status])],
    }));

  const PlaybackProgress = model("PlaybackProgress", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      sectionId: field.int().column("section_id"),
      positionMs: field.int().default(0).column("position_ms"),
      completed: field.boolean().default(false),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.userId, fields.sectionId])],
    }))
    .sql(({ cols, constraints }) => ({
      table: "playback_progress",
      indexes: [
        constraints.index([cols.userId, cols.updatedAt]),
        constraints.index([cols.sectionId]),
      ],
    }));

  /**
   * Bölüm sonu soruları (Pro anlatımında LLM üretir). Soru ve cevabın ayrı
   * sesleri vardır: soru çalar, öğrenci düşünür, sonra cevap çalar.
   */
  const QuizQuestion = model("QuizQuestion", {
    fields: {
      id: autoIncrementId(field),
      sectionId: field.int().column("section_id"),
      order: field.int(),
      question: field.text(),
      answer: field.text(),
      /** Cevabı bağlamıyla bir cümlede açıklar ("1329'da, Orhan Bey döneminde"). */
      detail: field.text(),
      questionAudioKey: field.text().column("question_audio_key"),
      questionDurationMs: field.int().column("question_duration_ms"),
      answerAudioKey: field.text().column("answer_audio_key"),
      answerDurationMs: field.int().column("answer_duration_ms"),
      createdAt: field.temporal.createdAtString().column("created_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.sectionId, fields.order])],
    }))
    .sql(() => ({ table: "quiz_questions" }));

  /**
   * Hafıza kancası önerisi (LLM). Not içeriği değildir; kullanıcı saklarsa
   * seslendirilir ve bölüm sonunda okunur.
   */
  const Mnemonic = model("Mnemonic", {
    fields: {
      id: autoIncrementId(field),
      documentId: field.int().column("document_id"),
      sectionId: field.int().optional().column("section_id"),
      position: field.int().default(0),
      topic: field.text(),
      hook: field.text(),
      explanation: field.text(),
      kept: field.boolean().default(false),
      dismissed: field.boolean().default(false),
      audioKey: field.text().optional().column("audio_key"),
      durationMs: field.int().optional().column("duration_ms"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "mnemonics",
    indexes: [
      constraints.index([cols.documentId, cols.position]),
      constraints.index([cols.sectionId]),
    ],
  }));

  return { Document, Section, PlaybackProgress, QuizQuestion, Mnemonic };
}
