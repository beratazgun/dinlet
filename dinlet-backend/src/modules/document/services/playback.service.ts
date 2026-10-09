import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { PageQueryDto } from "#/core/dtos/request/index.js";
import { OkResponse } from "#/core/http/index.js";
import { Paginator } from "#/core/utils/paginator.js";
import type { SavePlaybackBodyDto } from "#/modules/document/dtos/index.js";
import {
  SECTION_COMPLETED_EVENT,
  SectionCompletedEvent,
} from "#/modules/document/event/document.events.js";
import {
  PlaybackRepository,
  SectionRepository,
} from "#/modules/document/repository/index.js";

/** Dinleme ilerlemesi: kaldığı yer ve "devam et" listesi. */
@Injectable()
export class PlaybackService {
  constructor(
    private readonly playbackRepository: PlaybackRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly paginator: Paginator,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * İstemci dinlerken ~15 sn'de bir ve duraklatınca gönderir. Konum, sesin
   * süresini aşamaz.
   */
  async save(
    sectionId: number,
    body: SavePlaybackBodyDto,
    userId: number,
  ): Promise<OkResponse> {
    const section = await this.sectionRepository.findWithDocument(sectionId);
    if (
      !section?.document ||
      section.document.userId !== userId ||
      section.document.deletedAt
    ) {
      throw new NotFoundException(`Bölüm bulunamadı: ${sectionId}`);
    }

    const positionMs =
      section.durationMs === null
        ? body.positionMs
        : Math.min(body.positionMs, section.durationMs);
    const progress = await this.playbackRepository.save({
      userId,
      sectionId,
      positionMs,
      completed: body.completed,
    });
    if (body.completed) {
      // Beklenir: uygulama hemen ardından tekrar listesini açabilir.
      await this.eventEmitter.emitAsync(
        SECTION_COMPLETED_EVENT,
        new SectionCompletedEvent(userId, sectionId),
      );
    }
    return new OkResponse("Dinleme konumu kaydedildi", progress);
  }

  async listContinue(query: PageQueryDto, userId: number): Promise<OkResponse> {
    const { docs, pagination } = await this.paginator.apply({
      page: query.page,
      limit: query.limit,
      count: () => this.playbackRepository.countInProgress(userId),
      query: (window) =>
        this.playbackRepository.findInProgressPage(userId, window),
    });

    // "Bölüm 3/9" için belgelerin toplam bölüm sayısı (tek sorgu).
    const documentIds = docs.flatMap((progress) =>
      progress.section?.document ? [progress.section.document.id] : [],
    );
    const sectionCounts = new Map<number, number>();
    for (const state of await this.sectionRepository.findStatesByDocuments(
      [...new Set(documentIds)],
    )) {
      sectionCounts.set(
        state.documentId,
        (sectionCounts.get(state.documentId) ?? 0) + 1,
      );
    }

    const items = docs.flatMap((progress) =>
      progress.section?.document
        ? [
            {
              sectionId: progress.sectionId,
              sectionOrder: progress.section.order,
              sectionTitle: progress.section.title,
              documentId: progress.section.document.id,
              documentTitle: progress.section.document.title,
              sectionCount:
                sectionCounts.get(progress.section.document.id) ?? 0,
              positionMs: progress.positionMs,
              durationMs: progress.section.durationMs,
              audioKey: progress.section.audioKey,
              updatedAt: progress.updatedAt,
            },
          ]
        : [],
    );
    return new OkResponse("Devam edilecek bölümler", items, {
      meta: { pagination },
    });
  }
}
