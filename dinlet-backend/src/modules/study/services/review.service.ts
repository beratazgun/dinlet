import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { OkResponse } from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { ConsentService } from "#/modules/auth/services/consent.service.js";
import { UsageService } from "#/modules/billing/services/index.js";
import { fluentBlockReason } from "#/modules/billing/utils/index.js";
import type { SubmitReviewBodyDto } from "#/modules/study/dtos/index.js";
import {
  ReviewRepository,
  type ReviewQuestionRow,
  type ReviewSectionInfo,
} from "#/modules/study/repository/index.js";
import {
  addDays,
  isDue,
  nextReview,
  QUIZ_THINK_MS,
  REVIEW_INTERVALS,
  reviewStreak,
  stageLabel,
  weekStrip,
} from "#/modules/study/utils/index.js";

/** Bir oturumda en fazla bu kadar bölüm tekrar edilir. */
const SESSION_LIMIT = 20;
/** Yakında gelecek tekrarlar listesinin uzunluğu. */
const UPCOMING_LIMIT = 20;
/** Seri hesabı için geriye bakılan gün (daha uzun seriler bu sınırda kesilir). */
const STREAK_LOOKBACK_DAYS = 400;

/**
 * Aralıklı tekrar: bitirilen sorulu bölümler 1-3-7-21 gün aralıkla geri
 * gelir. Tekrar oturumu yalnızca özetleri ve soruları çalar.
 */
@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly usageService: UsageService,
    private readonly consentService: ConsentService,
    private readonly dateManager: DateManager,
  ) {}

  /** Bölüm bitirildi: sorusu varsa yarın ilk tekrara girer. */
  async enroll(userId: number, sectionId: number): Promise<void> {
    if ((await this.reviewRepository.countQuestions(sectionId)) === 0) return;
    const today = this.dateManager.calendarDay();
    await this.reviewRepository.enroll(
      userId,
      sectionId,
      addDays(today, REVIEW_INTERVALS[0]),
    );
  }

  /** "Bugünkü tekrar" ekranı: şerit, seri, bugünün yükü ve sıradakiler. */
  async summary(userId: number): Promise<OkResponse> {
    const today = this.dateManager.calendarDay();
    const [items, days, lockedBy] = await Promise.all([
      this.reviewRepository.listActive(userId),
      this.reviewRepository.listDays(
        userId,
        addDays(today, -STREAK_LOOKBACK_DAYS),
      ),
      this.lockReason(userId),
    ]);
    const sections = await this.reviewRepository.findSections(
      items.map((item) => item.sectionId),
    );
    const live = items.filter((item) => sections.has(item.sectionId));
    const questions = await this.reviewRepository.findQuestions(
      live.map((item) => item.sectionId),
    );

    const due = live.filter((item) => isDue(item.dueOn, today));
    const describe = (item: (typeof live)[number]) => {
      const section = sections.get(item.sectionId)!;
      return {
        sectionId: item.sectionId,
        sectionTitle: section.title,
        documentId: section.documentId,
        documentTitle: section.documentTitle,
        stage: item.stage,
        stageLabel: stageLabel(item.stage),
        dueOn: item.dueOn,
        isDue: isDue(item.dueOn, today),
        questionCount: questions.get(item.sectionId)?.length ?? 0,
      };
    };

    return new OkResponse("Bugünkü tekrar", {
      today,
      lockedBy,
      streakDays: reviewStreak(days, today),
      week: weekStrip(today, days),
      dueCount: due.length,
      estimatedMs: due.reduce(
        (sum, item) =>
          sum +
          sessionDuration(
            sections.get(item.sectionId)!,
            questions.get(item.sectionId) ?? [],
          ),
        0,
      ),
      items: [
        ...due,
        ...live
          .filter((item) => !isDue(item.dueOn, today))
          .slice(0, UPCOMING_LIMIT),
      ].map(describe),
    });
  }

  /** Bugünün tekrar oturumu: bölüm başına özet sesi ve sorular. */
  async session(userId: number): Promise<OkResponse> {
    const today = this.dateManager.calendarDay();
    const items = (await this.reviewRepository.listActive(userId)).filter(
      (item) => isDue(item.dueOn, today),
    );
    const sections = await this.reviewRepository.findSections(
      items.map((item) => item.sectionId),
    );
    const questions = await this.reviewRepository.findQuestions([
      ...sections.keys(),
    ]);

    const sessionSections = items
      .filter(
        (item) => sections.has(item.sectionId) && questions.has(item.sectionId),
      )
      .slice(0, SESSION_LIMIT)
      .map((item) => {
        const section = sections.get(item.sectionId)!;
        return {
          sectionId: section.id,
          sectionOrder: section.order,
          sectionTitle: section.title,
          documentId: section.documentId,
          documentTitle: section.documentTitle,
          stage: item.stage,
          stageLabel: stageLabel(item.stage),
          recapAudioKey: section.recapAudioKey,
          recapDurationMs: section.recapDurationMs,
          questions: questions.get(item.sectionId)!,
        };
      });
    return new OkResponse("Tekrar oturumu", {
      thinkMs: QUIZ_THINK_MS,
      sections: sessionSections,
    });
  }

  /** Bölümün sorularının sonucu: aşama ilerler ya da yarına döner. */
  async submit(
    userId: number,
    sectionId: number,
    body: SubmitReviewBodyDto,
  ): Promise<OkResponse> {
    const item = await this.reviewRepository.findItem(userId, sectionId);
    if (!item || item.graduated) {
      throw new NotFoundException(`Tekrar bulunamadı: ${sectionId}`);
    }
    const today = this.dateManager.calendarDay();
    if (!isDue(item.dueOn, today)) {
      throw new BadRequestException("Bu bölümün tekrar günü henüz gelmedi.");
    }

    const questions =
      (await this.reviewRepository.findQuestions([sectionId])).get(sectionId) ??
      [];
    const questionIds = new Set(questions.map((question) => question.id));
    if (body.answers.some((answer) => !questionIds.has(answer.questionId))) {
      throw new BadRequestException("Cevaplardan biri bu bölüme ait değil.");
    }

    const allKnown =
      body.answers.length > 0 && body.answers.every((answer) => answer.known);
    const outcome = nextReview(item.stage, allKnown, today);
    await this.reviewRepository.updateItem(item.id, {
      ...outcome,
      lastReviewedOn: today,
    });
    await this.reviewRepository.markDay(userId, today);

    return new OkResponse(
      allKnown ? "Tekrar ilerledi" : "Bölüm yarın tekrar gelecek",
      {
        sectionId,
        ...outcome,
        stageLabel: stageLabel(outcome.stage),
      },
    );
  }

  /** Sorular LLM ile üretildiği için Pro + yurt dışı aktarım rızası gerekir. */
  private async lockReason(userId: number) {
    const limits = await this.usageService.getPlanLimits(userId);
    return fluentBlockReason(
      limits,
      await this.consentService.hasCrossBorderTransferConsent(userId),
    );
  }
}

/** Oturumda bölümün tahmini süresi: özet + her soru, düşünme ve cevap. */
function sessionDuration(
  section: ReviewSectionInfo,
  questions: ReviewQuestionRow[],
): number {
  return (
    (section.recapDurationMs ?? 0) +
    questions.reduce(
      (sum, question) =>
        sum +
        question.questionDurationMs +
        QUIZ_THINK_MS +
        question.answerDurationMs,
      0,
    )
  );
}
