import {
  DocumentStatus,
  SectionStatus,
  type DocumentStatus as DocumentStatusValue,
  type SectionStatus as SectionStatusValue,
} from "#database/enums.js";

/**
 * Henüz seslendirilmemiş bölümün süresi için tahmin (Türkçe anlatım
 * yaklaşık saniyede 14–15 karakter). Hedef planlamasında kullanılır.
 */
export const ESTIMATED_MS_PER_CHAR = 70;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StudySectionRow {
  status: SectionStatusValue;
  durationMs: number | null;
  charCount: number;
  /** Kullanıcının bu bölümdeki dinleme durumu (kayıt yoksa `false` / 0). */
  completed: boolean;
  positionMs: number;
}

export interface DocumentStudyProgress {
  /** Dinlenebilir (sesi hazır) bölüm sayısı. */
  readySections: number;
  completedSections: number;
  /** Not dinlenebilir durumda ve hazır bölümlerin hepsi bitirildi. */
  finished: boolean;
  /** Bitirmek için kalan dinleme süresi (hazır olmayanlar tahmini). */
  remainingMs: number;
}

const LISTENABLE: DocumentStatusValue[] = [
  DocumentStatus.READY,
  DocumentStatus.PARTIAL,
];

export function summarizeDocument(
  status: DocumentStatusValue,
  sections: StudySectionRow[],
): DocumentStudyProgress {
  let readySections = 0;
  let completedSections = 0;
  let remainingMs = 0;

  for (const section of sections) {
    if (section.status === SectionStatus.READY) {
      readySections += 1;
      if (section.completed) {
        completedSections += 1;
        continue;
      }
      remainingMs += Math.max(
        0,
        (section.durationMs ?? section.charCount * ESTIMATED_MS_PER_CHAR) -
          section.positionMs,
      );
    } else if (section.status !== SectionStatus.FAILED) {
      // Henüz seslendirilmemiş: süresi karakterden tahmin edilir.
      remainingMs += section.charCount * ESTIMATED_MS_PER_CHAR;
    }
  }

  return {
    readySections,
    completedSections,
    finished:
      LISTENABLE.includes(status) &&
      readySections > 0 &&
      completedSections === readySections &&
      remainingMs === 0,
    remainingMs,
  };
}

/** `examDay - today` takvim günü farkı; ikisi de `YYYY-MM-DD`. */
export function daysUntil(examDay: string, today: string): number {
  const toUtc = (day: string) => {
    const [year, month, date] = day.split("-").map(Number) as [
      number,
      number,
      number,
    ];
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((toUtc(examDay) - toUtc(today)) / DAY_MS);
}

/**
 * Sınava yetişmek için günde dinlenmesi gereken dakika (yukarı yuvarlanır).
 * Sınav günü de dinlenebilir sayılır; geçmişse veya iş kalmadıysa `null`.
 */
export function dailyMinutesNeeded(
  remainingMs: number,
  daysLeft: number,
): number | null {
  if (remainingMs <= 0 || daysLeft < 0) return null;
  return Math.ceil(remainingMs / 60_000 / Math.max(1, daysLeft));
}

export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
