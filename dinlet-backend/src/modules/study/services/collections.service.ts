import { Injectable } from "@nestjs/common";

import { OkResponse } from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";

import { FolderService } from "./folder.service.js";
import { StudyGoalService } from "./study-goal.service.js";
import { StudyProgressService } from "./study-progress.service.js";
import { TagService } from "./tag.service.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** "Klasörlerin" ekranı: hedef, klasörler, etiketler ve akıllı filtre sayıları. */
@Injectable()
export class CollectionsService {
  constructor(
    private readonly progressService: StudyProgressService,
    private readonly folderService: FolderService,
    private readonly tagService: TagService,
    private readonly goalService: StudyGoalService,
    private readonly dateManager: DateManager,
  ) {}

  async get(userId: number): Promise<OkResponse> {
    const documents = await this.progressService.snapshot(userId);
    const weekAgo = this.dateManager.addMilliseconds(-WEEK_MS);
    const [goal, folders, tags] = await Promise.all([
      this.goalService.summarize(userId, documents),
      this.folderService.list(userId, documents),
      this.tagService.list(userId),
    ]);

    return new OkResponse("Klasörler", {
      goal,
      folders,
      tags,
      favoritesCount: documents.filter((document) => document.isFavorite)
        .length,
      thisWeekCount: documents.filter((document) =>
        this.dateManager.isAfter(document.createdAt, weekAgo),
      ).length,
      unfiledCount: documents.filter((document) => document.folderId === null)
        .length,
    });
  }
}
