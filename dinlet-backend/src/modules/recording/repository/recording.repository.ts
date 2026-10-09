import { Injectable } from "@nestjs/common";

import type { PageWindow } from "#/core/utils/paginator.js";
import type { SectionScript } from "#/modules/document/types/index.js";
import { DatabaseService } from "#database/database.service.js";
import {
  RecordingStatus,
  type RecordingStatus as RecordingStatusValue,
  type VoicePreference,
} from "#database/enums.js";

const RECORDING_FIELDS = [
  "id",
  "userId",
  "sectionId",
  "status",
  "useOwnVoice",
  "scriptHash",
  "audioKey",
  "durationMs",
  "sizeBytes",
  "recapStartMs",
  "recapDurationMs",
  "mixRun",
  "failureReason",
  "createdAt",
  "updatedAt",
] as const;

const CLIP_FIELDS = [
  "id",
  "recordingId",
  "position",
  "audioKey",
  "mimeType",
  "durationMs",
  "sizeBytes",
  "updatedAt",
] as const;

export interface RecordingPatch {
  status?: RecordingStatusValue;
  useOwnVoice?: boolean;
  scriptHash?: string;
  audioKey?: string | null;
  durationMs?: number | null;
  sizeBytes?: number | null;
  recapStartMs?: number | null;
  recapDurationMs?: number | null;
  mixRun?: number;
  failureReason?: string | null;
}

export interface NewClip {
  position: number;
  audioKey: string;
  mimeType: string;
  durationMs: number;
  sizeBytes: number;
}

/** Bölüm kayıtları ve paragraf klipleri. */
@Injectable()
export class RecordingRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /** Kaydedilecek bölüm: kullanıcının silinmemiş notunda. */
  async findSection(sectionId: number, userId: number) {
    const section = await this.db.orm.public.Section.where({ id: sectionId })
      .select("id", "order", "title", "status", "script", "scriptHash")
      .include("document", (document) =>
        document.select("id", "userId", "title", "storagePrefix", "deletedAt"),
      )
      .first();
    if (
      !section?.document ||
      section.document.userId !== userId ||
      section.document.deletedAt
    ) {
      return null;
    }
    return { ...section, script: section.script as SectionScript | null };
  }

  findBySection(userId: number, sectionId: number) {
    return this.db.orm.public.SectionRecording.where({ userId, sectionId })
      .select(...RECORDING_FIELDS)
      .first();
  }

  findById(id: number) {
    return this.db.orm.public.SectionRecording.where({ id })
      .select(...RECORDING_FIELDS)
      .first();
  }

  create(input: { userId: number; sectionId: number; scriptHash: string }) {
    return this.db.orm.public.SectionRecording.select(
      ...RECORDING_FIELDS,
    ).create(input);
  }

  async update(id: number, patch: RecordingPatch): Promise<void> {
    await this.db.orm.public.SectionRecording.where({ id }).updateAndCount(
      patch,
    );
  }

  /**
   * Birleştirme sonucunu yalnızca aynı "Kaydet" turu için yazar (arada
   * yeni klip kaydedildiyse sonuç eskidir). Yazıldıysa `true`.
   */
  async completeMix(
    id: number,
    mixRun: number,
    patch: RecordingPatch,
  ): Promise<boolean> {
    const updated = await this.db.orm.public.SectionRecording.where({
      id,
      mixRun,
    })
      .where((recording) => recording.status.eq(RecordingStatus.PROCESSING))
      .updateAndCount(patch);
    return updated > 0;
  }

  async delete(id: number): Promise<void> {
    await this.db.orm.public.SectionRecording.where({ id }).deleteAndCount();
  }

  findClips(recordingId: number) {
    return this.db.orm.public.RecordingClip.where({ recordingId })
      .select(...CLIP_FIELDS)
      .orderBy((clip) => clip.position.asc())
      .all();
  }

  /** Klibi yazar; aynı paragrafın eski klibi varsa yerine geçer. */
  async upsertClip(recordingId: number, clip: NewClip): Promise<void> {
    await this.db.orm.public.RecordingClip.upsert({
      create: { recordingId, ...clip },
      update: clip,
      conflictOn: { recordingId, position: clip.position },
    });
  }

  async deleteClips(recordingId: number): Promise<void> {
    await this.db.orm.public.RecordingClip.where({
      recordingId,
    }).deleteAndCount();
  }

  /** Paragraf sayısı değişince sınır dışında kalan klipler. */
  async deleteClipsFrom(recordingId: number, position: number): Promise<void> {
    await this.db.orm.public.RecordingClip.where({ recordingId })
      .where((clip) => clip.position.gte(position))
      .deleteAndCount();
  }

  /** Kullanıcının verilen (notu silinmemiş) bölümlerdeki kayıtları. */
  private ownedQuery(userId: number, sectionIds: number[]) {
    return this.db.orm.public.SectionRecording.where({ userId }).where(
      (recording) => recording.sectionId.in(sectionIds),
    );
  }

  /** Kullanıcının kayıtlı bölümlerinden notu silinmemiş olanların ID'leri. */
  async findLiveSectionIds(userId: number): Promise<number[]> {
    const recordings = await this.db.orm.public.SectionRecording.where({
      userId,
    })
      .select("sectionId")
      .all();
    if (recordings.length === 0) return [];
    const sections = await this.db.orm.public.Section.where((section) =>
      section.id.in(recordings.map((recording) => recording.sectionId)),
    )
      .select("id")
      .include("document", (document) => document.select("deletedAt"))
      .all();
    return sections
      .filter((section) => section.document && !section.document.deletedAt)
      .map((section) => section.id);
  }

  async count(userId: number, sectionIds: number[]): Promise<number> {
    if (sectionIds.length === 0) return 0;
    const { total } = await this.ownedQuery(userId, sectionIds).aggregate(
      (aggregate) => ({ total: aggregate.count() }),
    );
    return total;
  }

  async findPage(userId: number, sectionIds: number[], window: PageWindow) {
    if (sectionIds.length === 0) return [];
    return await this.ownedQuery(userId, sectionIds)
      .select(...RECORDING_FIELDS)
      .orderBy([
        (recording) => recording.updatedAt.desc(),
        (recording) => recording.id.desc(),
      ])
      .limit(window.limit)
      .offset(window.offset)
      .all();
  }

  /** Listedeki kayıtların bölüm/not başlıkları ve paragraf sayıları. */
  async findSectionsWithDocuments(sectionIds: number[]) {
    if (sectionIds.length === 0) return [];
    const rows = await this.db.orm.public.Section.where((section) =>
      section.id.in(sectionIds),
    )
      .select("id", "order", "title", "script", "scriptHash")
      .include("document", (document) => document.select("id", "title"))
      .all();
    return rows.map((row) => ({
      ...row,
      script: row.script as SectionScript | null,
    }));
  }

  /** Kayıtların klip sayısı ve toplam süresi (tek sorgu). */
  async findClipStats(
    recordingIds: number[],
  ): Promise<Map<number, { count: number; durationMs: number }>> {
    const stats = new Map<number, { count: number; durationMs: number }>();
    if (recordingIds.length === 0) return stats;
    const clips = await this.db.orm.public.RecordingClip.where((clip) =>
      clip.recordingId.in(recordingIds),
    )
      .select("recordingId", "durationMs")
      .all();
    for (const clip of clips) {
      const entry = stats.get(clip.recordingId) ?? { count: 0, durationMs: 0 };
      entry.count++;
      entry.durationMs += clip.durationMs;
      stats.set(clip.recordingId, entry);
    }
    return stats;
  }

  /** Kayıtlarım özeti için kullanıcının tüm kayıtları (durum ve süre). */
  findAllForSummary(userId: number, sectionIds: number[]) {
    if (sectionIds.length === 0) return Promise.resolve([]);
    return this.ownedQuery(userId, sectionIds)
      .select("id", "status", "durationMs")
      .all();
  }

  // ─── Ses tercihi ─────────────────────────────────────────────────────────

  findVoiceSetting(userId: number) {
    return this.db.orm.public.VoiceSetting.where({ userId })
      .select("voice")
      .first();
  }

  async upsertVoiceSetting(
    userId: number,
    voice: VoicePreference,
  ): Promise<void> {
    await this.db.orm.public.VoiceSetting.upsert({
      create: { userId, voice },
      update: { voice },
      conflictOn: { userId },
    });
  }
}
