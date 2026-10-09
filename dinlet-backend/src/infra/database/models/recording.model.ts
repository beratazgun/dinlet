import { enumType, member } from "@prisma/orm-postgres/contract-builder";
import {
  autoIncrementId,
  type ModelHelpers,
} from "#database/models/model.types.js";

const pgText = { codecId: "pg/text@1", nativeType: "text" } as const;

/**
 * Kullanıcının ses tercihi. `STANDARD` Dinlet'in yapay zekâ sesi; `NATURAL`
 * ikinci (Pro) ses, henüz yok; `OWN` kaydedilmiş bölümlerde kullanıcının
 * kendi sesi, kaydedilmemişlerde yapay zekâ sesi.
 */
export const VoicePreference = enumType(
  "VoicePreference",
  pgText,
  member("STANDARD"),
  member("NATURAL"),
  member("OWN"),
);

/**
 * Bölüm kaydının durumu: paragraflar kaydedilirken `DRAFT`, "Kaydet" ile
 * birleştirilirken `PROCESSING`, tek ses hazırsa `READY`, birleştirme
 * başarısızsa `FAILED`.
 */
export const RecordingStatus = enumType(
  "RecordingStatus",
  pgText,
  member("DRAFT"),
  member("PROCESSING"),
  member("READY"),
  member("FAILED"),
);

export const recordingEnums = { VoicePreference, RecordingStatus };

export function createRecordingModels({ field, model }: ModelHelpers) {
  const VoiceSetting = model("VoiceSetting", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().unique().column("user_id"),
      voice: field
        .namedType(VoicePreference)
        .default(VoicePreference.members.STANDARD),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(() => ({ table: "voice_settings" }));

  /**
   * Bir bölümün kullanıcının kendi sesiyle kaydı. Paragraf klipleri ayrı
   * tutulur (tek paragraf yeniden kaydedilebilsin); "Kaydet" ile worker
   * hepsini tek MP3'e birleştirir (`audioKey`).
   */
  const SectionRecording = model("SectionRecording", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      sectionId: field.int().column("section_id"),
      status: field
        .namedType(RecordingStatus)
        .default(RecordingStatus.members.DRAFT),
      /** Bu bölümde kendi sesi mi çalsın ("Bu bölümde hangi ses çalsın?"). */
      useOwnVoice: field.boolean().default(true).column("use_own_voice"),
      /** Kayıt alınırken bölümün anlatım özeti; anlatım değişirse kayıt eskir. */
      scriptHash: field.text().column("script_hash"),
      audioKey: field.text().optional().column("audio_key"),
      durationMs: field.int().optional().column("duration_ms"),
      sizeBytes: field.int().optional().column("size_bytes"),
      /** Birleşik seste tekrar özetinin başladığı yer ve süresi. */
      recapStartMs: field.int().optional().column("recap_start_ms"),
      recapDurationMs: field.int().optional().column("recap_duration_ms"),
      /** Her "Kaydet"te artar; birleştirme job'unun kimliğidir. */
      mixRun: field.int().default(0).column("mix_run"),
      failureReason: field.text().optional().column("failure_reason"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.userId, fields.sectionId])],
    }))
    .sql(({ cols, constraints }) => ({
      table: "section_recordings",
      indexes: [
        constraints.index([cols.userId, cols.updatedAt]),
        constraints.index([cols.sectionId]),
      ],
    }));

  /** Paragraf kaydı. `position` = paragraf sırası; özet en sonda (`n`). */
  const RecordingClip = model("RecordingClip", {
    fields: {
      id: autoIncrementId(field),
      recordingId: field.int().column("recording_id"),
      position: field.int(),
      audioKey: field.text().column("audio_key"),
      mimeType: field.text().column("mime_type"),
      durationMs: field.int().column("duration_ms"),
      sizeBytes: field.int().column("size_bytes"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.recordingId, fields.position])],
    }))
    .sql(() => ({ table: "recording_clips" }));

  return { VoiceSetting, SectionRecording, RecordingClip };
}
