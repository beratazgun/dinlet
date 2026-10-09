import { BadRequestException, Injectable } from "@nestjs/common";

import { NoContentResponse, OkResponse } from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import type { UpsertStudyGoalBodyDto } from "#/modules/study/dtos/index.js";
import { StudyGoalRepository } from "#/modules/study/repository/index.js";
import {
  dailyMinutesNeeded,
  daysUntil,
  percent,
} from "#/modules/study/utils/index.js";

import {
  StudyProgressService,
  type StudyDocument,
} from "./study-progress.service.js";

/** Hedef en fazla bu kadar gün ileride olabilir (~3 yıl). */
const MAX_DAYS_AHEAD = 1_100;

/**
 * Sınav hedefi: kalan gün, bitirilen notlar ve yetişmek için günlük
 * dinleme süresi. Hedef tüm kütüphaneyi kapsar.
 */
@Injectable()
export class StudyGoalService {
  constructor(
    private readonly goalRepository: StudyGoalRepository,
    private readonly progressService: StudyProgressService,
    private readonly dateManager: DateManager,
  ) {}

  async upsert(
    body: UpsertStudyGoalBodyDto,
    userId: number,
  ): Promise<OkResponse> {
    if (!isCalendarDay(body.examDate)) {
      throw new BadRequestException("Geçerli bir sınav tarihi seç.");
    }
    const daysLeft = daysUntil(body.examDate, this.dateManager.calendarDay());
    if (daysLeft < 0) {
      throw new BadRequestException("Sınav tarihi geçmişte olamaz.");
    }
    if (daysLeft > MAX_DAYS_AHEAD) {
      throw new BadRequestException(
        "Sınav tarihi en fazla 3 yıl sonrası olabilir.",
      );
    }

    await this.goalRepository.upsert(userId, {
      examName: body.examName,
      examDate: body.examDate,
    });
    const documents = await this.progressService.snapshot(userId);
    return new OkResponse(
      "Sınav hedefi kaydedildi",
      this.describe(body.examName, body.examDate, documents),
    );
  }

  async remove(userId: number): Promise<NoContentResponse> {
    await this.goalRepository.delete(userId);
    return new NoContentResponse("Sınav hedefi kaldırıldı");
  }

  /** Kayıtlı hedefin özeti; hedef yoksa `null`. */
  async summarize(userId: number, documents: StudyDocument[]) {
    const goal = await this.goalRepository.findByUser(userId);
    return goal ? this.describe(goal.examName, goal.examDate, documents) : null;
  }

  private describe(
    examName: string,
    examDate: string,
    documents: StudyDocument[],
  ) {
    const daysLeft = daysUntil(examDate, this.dateManager.calendarDay());
    const finishedCount = documents.filter(
      (document) => document.progress.finished,
    ).length;
    const remainingListenMs = documents.reduce(
      (sum, document) => sum + document.progress.remainingMs,
      0,
    );
    return {
      examName,
      examDate,
      daysLeft,
      documentCount: documents.length,
      finishedCount,
      progressPercent: percent(finishedCount, documents.length),
      remainingListenMs,
      dailyMinutes: dailyMinutesNeeded(remainingListenMs, daysLeft),
    };
  }
}

/** `2026-02-30` gibi takvimde olmayan günleri reddeder. */
function isCalendarDay(day: string): boolean {
  const [year, month, date] = day.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === date
  );
}
