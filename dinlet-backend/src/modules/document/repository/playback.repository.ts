import { Injectable } from "@nestjs/common";

import type { PageWindow } from "#/core/utils/paginator.js";
import { DatabaseService } from "#database/database.service.js";

/** Kullanıcının bölüm bazında dinleme ilerlemesi (kaldığı yer). */
@Injectable()
export class PlaybackRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  save(input: {
    userId: number;
    sectionId: number;
    positionMs: number;
    completed: boolean;
  }) {
    return this.db.orm.public.PlaybackProgress.select(
      "sectionId",
      "positionMs",
      "completed",
      "updatedAt",
    ).upsert({
      create: input,
      update: { positionMs: input.positionMs, completed: input.completed },
      conflictOn: { userId: input.userId, sectionId: input.sectionId },
    });
  }

  findForSection(userId: number, sectionId: number) {
    return this.db.orm.public.PlaybackProgress.where({ userId, sectionId })
      .select("positionMs", "completed", "updatedAt")
      .first();
  }

  private inProgress(userId: number) {
    return this.db.orm.public.PlaybackProgress.where({
      userId,
      completed: false,
    }).where((progress) => progress.positionMs.gt(0));
  }

  async countInProgress(userId: number): Promise<number> {
    const { total } = await this.inProgress(userId).aggregate((aggregate) => ({
      total: aggregate.count(),
    }));
    return total;
  }

  /** Yarım kalan bölümler, en son dinlenen önce. */
  findInProgressPage(userId: number, window: PageWindow) {
    return this.inProgress(userId)
      .select("sectionId", "positionMs", "completed", "updatedAt")
      .include("section", (section) =>
        section
          .select("id", "order", "title", "durationMs", "audioKey")
          .include("document", (document) => document.select("id", "title")),
      )
      .orderBy([
        (progress) => progress.updatedAt.desc(),
        (progress) => progress.id.desc(),
      ])
      .offset(window.offset)
      .limit(window.limit)
      .all();
  }
}
