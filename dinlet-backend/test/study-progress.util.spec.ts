import { describe, expect, it } from "vitest";

import {
  dailyMinutesNeeded,
  daysUntil,
  ESTIMATED_MS_PER_CHAR,
  summarizeDocument,
  type StudySectionRow,
} from "#/modules/study/utils/index.js";

const ready = (overrides: Partial<StudySectionRow> = {}): StudySectionRow => ({
  status: "READY",
  durationMs: 600_000,
  charCount: 8_000,
  completed: false,
  positionMs: 0,
  ...overrides,
});

describe("summarizeDocument", () => {
  it("tüm hazır bölümler bitince notu bitmiş sayar", () => {
    const progress = summarizeDocument("READY", [
      ready({ completed: true }),
      ready({ completed: true }),
    ]);
    expect(progress).toEqual({
      readySections: 2,
      completedSections: 2,
      finished: true,
      remainingMs: 0,
    });
  });

  it("kalan süreye yarım kalan konumu ve hazır olmayan bölümün tahminini katar", () => {
    const progress = summarizeDocument("SYNTHESIZING", [
      ready({ completed: true }),
      ready({ positionMs: 100_000 }),
      ready({ status: "PENDING", durationMs: null, charCount: 1_000 }),
    ]);
    expect(progress.finished).toBe(false);
    expect(progress.remainingMs).toBe(500_000 + 1_000 * ESTIMATED_MS_PER_CHAR);
  });

  it("seslendirilemeyen bölümü kalan işe saymaz; kısmen hazır not bitirilebilir", () => {
    const progress = summarizeDocument("PARTIAL", [
      ready({ completed: true }),
      ready({ status: "FAILED", durationMs: null }),
    ]);
    expect(progress.finished).toBe(true);
    expect(progress.remainingMs).toBe(0);
  });

  it("henüz bölümü olmayan not bitmiş sayılmaz", () => {
    expect(summarizeDocument("QUEUED", []).finished).toBe(false);
  });
});

describe("sınav hedefi", () => {
  it("takvim günü farkını ay ve yıl sınırında doğru sayar", () => {
    expect(daysUntil("2026-11-16", "2026-10-09")).toBe(38);
    expect(daysUntil("2027-01-02", "2026-12-31")).toBe(2);
    expect(daysUntil("2026-10-09", "2026-10-09")).toBe(0);
    expect(daysUntil("2026-10-01", "2026-10-09")).toBe(-8);
  });

  it("günlük dakikayı yukarı yuvarlar; sınav günü 1 gün sayılır", () => {
    expect(dailyMinutesNeeded(38 * 35 * 60_000 - 1, 38)).toBe(35);
    expect(dailyMinutesNeeded(90 * 60_000, 0)).toBe(90);
    expect(dailyMinutesNeeded(0, 10)).toBeNull();
    expect(dailyMinutesNeeded(60_000, -1)).toBeNull();
  });
});
