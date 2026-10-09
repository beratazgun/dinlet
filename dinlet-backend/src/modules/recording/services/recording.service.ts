import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { nanoid } from "nanoid";

import { NoContentResponse, OkResponse } from "#/core/http/index.js";
import { Paginator } from "#/core/utils/paginator.js";
import { S3Service } from "#/infra/s3/s3.service.js";
import type {
  RecordingListQueryDto,
  UpdateRecordingBodyDto,
} from "#/modules/recording/dtos/index.js";
// Barrel değil: kuyruk olay dinleyicisi bu servise bağlı (dairesel import).
import { RecordingMixQueueService } from "#/modules/recording/queue/recording-mix-queue.service.js";
import type { RecordingMixJobResult } from "#/modules/recording/queue/recording-queue.types.js";
import { RecordingRepository } from "#/modules/recording/repository/index.js";
import {
  audioExtension,
  MAX_CLIP_BYTES,
  recordingParts,
  recordingPrefix,
} from "#/modules/recording/utils/index.js";
import {
  RecordingStatus,
  SectionStatus,
  VoicePreference,
} from "#database/enums.js";

type SectionRow = NonNullable<
  Awaited<ReturnType<RecordingRepository["findSection"]>>
>;
type RecordingRow = NonNullable<
  Awaited<ReturnType<RecordingRepository["findById"]>>
>;

export interface UploadedClip {
  mimeType: string;
  buffer: Buffer;
}

/**
 * Kendi sesinle kayıt: bölümün paragrafları tek tek kaydedilir, "Kaydet"
 * ile worker hepsini tek MP3'e birleştirir. Kayıt dosyaları notun ses
 * önekinde durur; not silinince onlarla birlikte temizlenir. Kota düşmez.
 */
@Injectable()
export class RecordingService {
  private readonly logger = new Logger(RecordingService.name);

  constructor(
    private readonly recordingRepository: RecordingRepository,
    private readonly mixQueue: RecordingMixQueueService,
    private readonly s3Service: S3Service,
    private readonly paginator: Paginator,
  ) {}

  async get(sectionId: number, userId: number): Promise<OkResponse> {
    const section = await this.findRecordableSection(sectionId, userId);
    const recording = await this.currentRecording(section, userId);
    return new OkResponse("Bölüm kaydı", await this.detail(section, recording));
  }

  /** Paragraf kaydını yazar (varsa eskisinin yerine). Kayıt yarım duruma döner. */
  async saveClip(
    sectionId: number,
    position: number,
    durationMs: number,
    file: UploadedClip,
    userId: number,
  ): Promise<OkResponse> {
    const section = await this.findRecordableSection(sectionId, userId);
    const parts = recordingParts(section.script);
    if (position >= parts.length) {
      throw new UnprocessableEntityException(
        `Bu bölümde ${parts.length} paragraf var; sıra ${position} geçersiz.`,
      );
    }
    const extension = audioExtension(file.mimeType);
    if (!extension) {
      throw new UnprocessableEntityException(
        "Yalnızca ses dosyaları kaydedilebilir.",
      );
    }
    if (file.buffer.length === 0 || file.buffer.length > MAX_CLIP_BYTES) {
      throw new UnprocessableEntityException(
        "Kayıt dosyası boş veya çok büyük.",
      );
    }

    const recording =
      (await this.currentRecording(section, userId)) ??
      (await this.recordingRepository.create({
        userId,
        sectionId,
        scriptHash: section.scriptHash ?? "",
      }));

    const previous = (
      await this.recordingRepository.findClips(recording.id)
    ).find((clip) => clip.position === position);
    const audioKey = `${recordingPrefix({
      userId,
      documentId: section.document!.id,
      storagePrefix: section.document!.storagePrefix,
      sectionId,
    })}/${position}-${nanoid(10)}.${extension}`;
    await this.s3Service.uploadBuffer(file.buffer, file.mimeType, audioKey);
    await this.recordingRepository.upsertClip(recording.id, {
      position,
      audioKey,
      mimeType: file.mimeType,
      durationMs,
      sizeBytes: file.buffer.length,
    });
    if (previous) await this.deleteFiles([previous.audioKey]);

    // Yeni klip birleşik sesi eskitir; "Kaydet"e kadar Dinlet sesi çalar.
    if (recording.status !== RecordingStatus.DRAFT) {
      await this.recordingRepository.update(recording.id, {
        status: RecordingStatus.DRAFT,
        failureReason: null,
      });
    }
    return new OkResponse(
      "Paragraf kaydedildi",
      await this.detail(
        section,
        await this.recordingRepository.findById(recording.id),
      ),
    );
  }

  /**
   * "Bu bölümde hangi ses çalsın?" ve "Kaydet". Kaydet tüm paragraflar
   * kayıtlıysa birleştirmeyi kuyruğa alır. Kendi sesi seçilince genel ses
   * tercihi de "Benim sesim" olur ki kayıt gerçekten çalsın.
   */
  async update(
    sectionId: number,
    body: UpdateRecordingBodyDto,
    userId: number,
  ): Promise<OkResponse> {
    const section = await this.findRecordableSection(sectionId, userId);
    const recording = await this.currentRecording(section, userId);
    if (!recording) throw new NotFoundException("Bu bölümün kaydı yok.");

    if (body.useOwnVoice !== undefined) {
      await this.recordingRepository.update(recording.id, {
        useOwnVoice: body.useOwnVoice,
      });
      if (body.useOwnVoice) await this.preferOwnVoice(userId);
    }

    if (body.finalize) {
      const parts = recordingParts(section.script);
      const clips = await this.recordingRepository.findClips(recording.id);
      const missing = parts.length - clips.length;
      if (missing > 0) {
        throw new UnprocessableEntityException({
          message: `${missing} paragraf kaydedilmedi; önce hepsini kaydet.`,
          code: "RECORDING_INCOMPLETE",
        });
      }
      if (recording.status !== RecordingStatus.READY) {
        const run = recording.mixRun + 1;
        await this.recordingRepository.update(recording.id, {
          status: RecordingStatus.PROCESSING,
          mixRun: run,
          failureReason: null,
        });
        const recapPart = parts.find((part) => part.kind === "RECAP");
        await this.mixQueue.enqueue(
          {
            recordingId: recording.id,
            userId,
            audioKey: `${recordingPrefix({
              userId,
              documentId: section.document!.id,
              storagePrefix: section.document!.storagePrefix,
              sectionId,
            })}/mix-${run}-${nanoid(10)}.mp3`,
            recapPosition: recapPart?.position ?? null,
            clips: clips.map((clip) => ({
              position: clip.position,
              audioKey: clip.audioKey,
            })),
          },
          run,
        );
      }
    }

    return new OkResponse(
      body.finalize ? "Kayıt hazırlanıyor" : "Kayıt güncellendi",
      await this.detail(
        section,
        await this.recordingRepository.findById(recording.id),
      ),
    );
  }

  /** Kaydı ve tüm dosyalarını siler; bölüm Dinlet sesiyle çalar. */
  async remove(sectionId: number, userId: number): Promise<NoContentResponse> {
    const section = await this.findRecordableSection(sectionId, userId);
    const recording = await this.recordingRepository.findBySection(
      userId,
      section.id,
    );
    if (!recording) throw new NotFoundException("Bu bölümün kaydı yok.");
    await this.removeRecording(recording);
    return new NoContentResponse("Kayıt silindi");
  }

  /** "Kayıtlarım": en son güncellenen önce. */
  async list(
    query: RecordingListQueryDto,
    userId: number,
  ): Promise<OkResponse> {
    const sectionIds =
      await this.recordingRepository.findLiveSectionIds(userId);
    const { docs, pagination } = await this.paginator.apply({
      page: query.page,
      limit: query.limit,
      count: () => this.recordingRepository.count(userId, sectionIds),
      query: (window) =>
        this.recordingRepository.findPage(userId, sectionIds, window),
    });
    const [sections, clipStats] = await Promise.all([
      this.recordingRepository.findSectionsWithDocuments(
        docs.map((recording) => recording.sectionId),
      ),
      this.recordingRepository.findClipStats(
        docs.map((recording) => recording.id),
      ),
    ]);
    const sectionById = new Map(
      sections.map((section) => [section.id, section]),
    );

    const items = docs.flatMap((recording) => {
      const section = sectionById.get(recording.sectionId);
      if (!section?.document) return [];
      const stats = clipStats.get(recording.id) ?? { count: 0, durationMs: 0 };
      return [
        {
          sectionId: section.id,
          sectionOrder: section.order,
          sectionTitle: section.title,
          documentId: section.document.id,
          documentTitle: section.document.title,
          status: recording.status,
          useOwnVoice: recording.useOwnVoice,
          durationMs:
            recording.status === RecordingStatus.READY && recording.durationMs
              ? recording.durationMs
              : stats.durationMs,
          recordedCount: stats.count,
          totalCount: recordingParts(section.script).length,
          updatedAt: recording.updatedAt,
        },
      ];
    });
    return new OkResponse("Kayıtlar listelendi", items, {
      meta: { pagination },
    });
  }

  async summary(userId: number): Promise<OkResponse> {
    const sectionIds =
      await this.recordingRepository.findLiveSectionIds(userId);
    const recordings = await this.recordingRepository.findAllForSummary(
      userId,
      sectionIds,
    );
    const ready = recordings.filter(
      (recording) => recording.status === RecordingStatus.READY,
    );
    return new OkResponse("Kayıt özeti", {
      readyCount: ready.length,
      draftCount: recordings.length - ready.length,
      totalDurationMs: ready.reduce(
        (sum, recording) => sum + (recording.durationMs ?? 0),
        0,
      ),
    });
  }

  /** Worker birleştirmeyi bitirdi: yalnızca aynı "Kaydet" turunun sonucu yazılır. */
  async completeMix(
    recordingId: number,
    run: number,
    result: RecordingMixJobResult,
  ): Promise<void> {
    const recording = await this.recordingRepository.findById(recordingId);
    if (!recording) {
      await this.deleteFiles([result.audioKey]);
      return;
    }
    const section = await this.recordingRepository.findSection(
      recording.sectionId,
      recording.userId,
    );
    const recapPosition = recordingParts(section?.script ?? null).find(
      (part) => part.kind === "RECAP",
    )?.position;
    const recap = (result.clips ?? []).find(
      (clip) => clip.position === recapPosition,
    );

    const written = await this.recordingRepository.completeMix(
      recordingId,
      run,
      {
        status: RecordingStatus.READY,
        audioKey: result.audioKey,
        durationMs: result.durationMs,
        sizeBytes: result.sizeBytes,
        recapStartMs: recap?.startMs ?? null,
        recapDurationMs: recap ? result.durationMs - recap.startMs : null,
      },
    );
    if (!written) {
      // Arada yeni paragraf kaydedildi: bu sonuç artık geçersiz.
      await this.deleteFiles([result.audioKey]);
      return;
    }
    if (recording.audioKey && recording.audioKey !== result.audioKey) {
      await this.deleteFiles([recording.audioKey]);
    }
  }

  async failMix(recordingId: number, run: number): Promise<void> {
    const recording = await this.recordingRepository.findById(recordingId);
    if (!recording || recording.mixRun !== run) return;
    await this.recordingRepository.completeMix(recordingId, run, {
      status: RecordingStatus.FAILED,
      failureReason: 'Kayıt birleştirilemedi; tekrar "Kaydet"e bas.',
    });
  }

  private async findRecordableSection(sectionId: number, userId: number) {
    const section = await this.recordingRepository.findSection(
      sectionId,
      userId,
    );
    if (!section) throw new NotFoundException(`Bölüm bulunamadı: ${sectionId}`);
    if (section.status !== SectionStatus.READY || !section.script) {
      throw new ConflictException("Bölüm hazır olunca kaydedebilirsin.");
    }
    return section;
  }

  /**
   * Bölümün anlatımı kayıttan sonra değiştiyse (yeniden üretim) eski kayıt
   * artık metinle uyuşmaz; silinir ve kayıt baştan başlar.
   */
  private async currentRecording(
    section: SectionRow,
    userId: number,
  ): Promise<RecordingRow | null> {
    const recording = await this.recordingRepository.findBySection(
      userId,
      section.id,
    );
    if (!recording) return null;
    if (recording.scriptHash === (section.scriptHash ?? "")) return recording;
    this.logger.log(`Kayıt#${recording.id} anlatım değiştiği için sıfırlandı`);
    await this.removeRecording(recording);
    return null;
  }

  private async removeRecording(recording: RecordingRow): Promise<void> {
    const clips = await this.recordingRepository.findClips(recording.id);
    await this.recordingRepository.delete(recording.id);
    await this.deleteFiles([
      ...clips.map((clip) => clip.audioKey),
      ...(recording.audioKey ? [recording.audioKey] : []),
    ]);
  }

  private async preferOwnVoice(userId: number): Promise<void> {
    const setting = await this.recordingRepository.findVoiceSetting(userId);
    if (setting?.voice !== VoicePreference.OWN) {
      await this.recordingRepository.upsertVoiceSetting(
        userId,
        VoicePreference.OWN,
      );
    }
  }

  private async detail(section: SectionRow, recording: RecordingRow | null) {
    const clips = recording
      ? await this.recordingRepository.findClips(recording.id)
      : [];
    const clipByPosition = new Map(clips.map((clip) => [clip.position, clip]));
    const parts = recordingParts(section.script);
    return {
      sectionId: section.id,
      sectionOrder: section.order,
      sectionTitle: section.title,
      documentId: section.document!.id,
      documentTitle: section.document!.title,
      status: recording?.status ?? null,
      useOwnVoice: recording?.useOwnVoice ?? true,
      durationMs:
        recording?.status === RecordingStatus.READY
          ? recording.durationMs
          : null,
      audioKey:
        recording?.status === RecordingStatus.READY ? recording.audioKey : null,
      recordedCount: clips.filter((clip) => clip.position < parts.length)
        .length,
      totalCount: parts.length,
      recordedDurationMs: clips.reduce((sum, clip) => sum + clip.durationMs, 0),
      failureReason: recording?.failureReason ?? null,
      parts: parts.map((part) => ({
        ...part,
        clip: clipByPosition.get(part.position) ?? null,
      })),
    };
  }

  /** Dosya silme hatası işi durdurmaz; yetim dosya not silinince temizlenir. */
  private async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.s3Service.deleteFiles(keys);
    } catch (error) {
      this.logger.warn(
        `Kayıt dosyaları silinemedi: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
