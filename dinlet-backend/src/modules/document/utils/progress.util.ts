import { DocumentStatus, SectionStatus } from "#database/enums.js";

/** İlerleme yüzdesinin adım payları (doküman §4 "İlerleme"). */
const EXTRACT_SHARE = 10;
const SPLIT_SHARE = 5;
const SYNTH_SHARE = 100 - EXTRACT_SHARE - SPLIT_SHARE;

export interface ProgressSection {
  id: number;
  charCount: number;
  status: SectionStatus;
}

export interface DocumentProgress {
  percent: number;
  readySectionIds: number[];
}

/**
 * Belgenin ilerleme yüzdesi: metin çıkarma sabit %10, bölümleme %5, kalan
 * %85 sesi hazır bölümlerin karakter sayısının toplama oranı.
 */
export function computeProgress(
  status: DocumentStatus,
  sections: ProgressSection[],
): DocumentProgress {
  const readySectionIds = sections
    .filter((section) => section.status === SectionStatus.READY)
    .map((section) => section.id);

  if (status === DocumentStatus.READY) return { percent: 100, readySectionIds };
  if (status === DocumentStatus.QUEUED || status === DocumentStatus.EXTRACTING) {
    return { percent: 0, readySectionIds };
  }
  if (sections.length === 0) return { percent: EXTRACT_SHARE, readySectionIds };

  const totalChars = sections.reduce((sum, s) => sum + s.charCount, 0);
  const readyChars = sections
    .filter((section) => section.status === SectionStatus.READY)
    .reduce((sum, section) => sum + section.charCount, 0);
  const synthesized = totalChars > 0 ? readyChars / totalChars : 0;

  return {
    percent: Math.min(
      99,
      Math.floor(EXTRACT_SHARE + SPLIT_SHARE + SYNTH_SHARE * synthesized),
    ),
    readySectionIds,
  };
}

/** Bölüm artık değişmeyecek bir durumda mı (hazır veya kalıcı başarısız)? */
export function isSectionSettled(status: SectionStatus): boolean {
  return status === SectionStatus.READY || status === SectionStatus.FAILED;
}

/**
 * Tüm bölümler sonuçlandığında belgenin son durumu: hepsi hazırsa `READY`,
 * en az biri hazırsa `PARTIAL`, hiçbiri hazır değilse `FAILED`. Bekleyen
 * bölüm varsa `null` (henüz karar yok).
 */
export function resolveFinalStatus(
  sections: Pick<ProgressSection, "status">[],
): DocumentStatus | null {
  if (sections.length === 0) return null;
  if (!sections.every((section) => isSectionSettled(section.status))) {
    return null;
  }
  const readyCount = sections.filter(
    (section) => section.status === SectionStatus.READY,
  ).length;
  if (readyCount === sections.length) return DocumentStatus.READY;
  return readyCount > 0 ? DocumentStatus.PARTIAL : DocumentStatus.FAILED;
}
