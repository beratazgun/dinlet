import { daysUntil } from "./study-progress.util.js";

/**
 * Aralıklı tekrar aşamaları: bölüm bitirildikten 1 gün sonra, ardından
 * her başarılı tekrardan 3, 7 ve 21 gün sonra. Son aşama da bilinirse biter.
 */
export const REVIEW_INTERVALS = [1, 3, 7, 21] as const;

/** Soru başına düşünme süresi (sesli soru ekranındaki geri sayım). */
export const QUIZ_THINK_MS = 5_000;

/** Takvim gününe gün ekler (`YYYY-MM-DD`). */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const next = new Date(Date.UTC(year, month - 1, date + days));
  return next.toISOString().slice(0, 10);
}

/** Aşamanın etiketi: "1. gün", "3. gün", "7. gün", "21. gün". */
export function stageLabel(stage: number): string {
  const interval =
    REVIEW_INTERVALS[Math.min(stage, REVIEW_INTERVALS.length - 1)]!;
  return `${interval}. gün`;
}

export interface ReviewOutcome {
  stage: number;
  dueOn: string;
  graduated: boolean;
}

/**
 * Tekrar sonucu: hepsi bilindiyse bir sonraki aşama; biri bilinemediyse
 * başa dönülür ve bölüm ertesi gün tekrar gelir.
 */
export function nextReview(
  stage: number,
  allKnown: boolean,
  today: string,
): ReviewOutcome {
  if (!allKnown) {
    return {
      stage: 0,
      dueOn: addDays(today, REVIEW_INTERVALS[0]),
      graduated: false,
    };
  }
  const nextStage = stage + 1;
  if (nextStage >= REVIEW_INTERVALS.length) {
    return { stage: nextStage, dueOn: today, graduated: true };
  }
  return {
    stage: nextStage,
    dueOn: addDays(today, REVIEW_INTERVALS[nextStage]!),
    graduated: false,
  };
}

/**
 * Aralıksız tekrar günü sayısı. Bugün henüz tekrar yapılmadıysa seri dünden
 * geriye sayılır (gün bitmeden seri bozulmuş sayılmaz).
 */
export function reviewStreak(days: Iterable<string>, today: string): number {
  const done = new Set(days);
  let cursor = done.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Bu haftanın günleri (Pazartesi–Pazar), tekrar yapılıp yapılmadığıyla. */
export function weekStrip(
  today: string,
  doneDays: Iterable<string>,
): { day: string; label: string; done: boolean; isToday: boolean }[] {
  const labels = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
  const done = new Set(doneDays);
  const [year, month, date] = today.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  // getUTCDay: 0 = Pazar; Pazartesi başlangıçlı hafta için kaydırılır.
  const weekday =
    (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7;
  const monday = addDays(today, -weekday);
  return labels.map((label, index) => {
    const day = addDays(monday, index);
    return { day, label, done: done.has(day), isToday: day === today };
  });
}

/** Bölüm bugün tekrar edilmeli mi (gecikenler dahil)? */
export function isDue(dueOn: string, today: string): boolean {
  return daysUntil(dueOn, today) <= 0;
}
