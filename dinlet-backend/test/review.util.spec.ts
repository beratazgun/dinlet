import { describe, expect, it } from "vitest";

import {
  addDays,
  isDue,
  nextReview,
  reviewStreak,
  stageLabel,
  weekStrip,
} from "#/modules/study/utils/index.js";

describe("aralıklı tekrar", () => {
  it("bilinen bölüm 1 → 3 → 7 → 21 gün aralıkla ilerler ve biter", () => {
    expect(nextReview(0, true, "2026-10-09")).toEqual({
      stage: 1,
      dueOn: "2026-10-12",
      graduated: false,
    });
    expect(nextReview(1, true, "2026-10-12").dueOn).toBe("2026-10-19");
    expect(nextReview(2, true, "2026-10-19").dueOn).toBe("2026-11-09");
    expect(nextReview(3, true, "2026-11-09")).toMatchObject({
      graduated: true,
    });
  });

  it("bilinemeyen bölüm başa döner ve yarın gelir", () => {
    expect(nextReview(2, false, "2026-12-31")).toEqual({
      stage: 0,
      dueOn: "2027-01-01",
      graduated: false,
    });
  });

  it("aşama etiketleri ve gecikme", () => {
    expect([0, 1, 2, 3].map(stageLabel)).toEqual([
      "1. gün",
      "3. gün",
      "7. gün",
      "21. gün",
    ]);
    expect(isDue("2026-10-08", "2026-10-09")).toBe(true);
    expect(isDue("2026-10-09", "2026-10-09")).toBe(true);
    expect(isDue("2026-10-10", "2026-10-09")).toBe(false);
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("seri bugün yapılmadıysa dünden sayılır, boşlukta biter", () => {
    const days = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];
    expect(reviewStreak(days, "2026-10-09")).toBe(4);
    expect(reviewStreak([...days, "2026-10-09"], "2026-10-09")).toBe(5);
    expect(reviewStreak(["2026-10-06"], "2026-10-09")).toBe(0);
  });

  it("haftalık şerit pazartesiden başlar", () => {
    // 9 Ekim 2026 cuma.
    const strip = weekStrip("2026-10-09", ["2026-10-05", "2026-10-08"]);
    expect(strip.map((day) => day.label)).toEqual([
      "Pt",
      "Sa",
      "Ça",
      "Pe",
      "Cu",
      "Ct",
      "Pz",
    ]);
    expect(strip[0]).toMatchObject({ day: "2026-10-05", done: true });
    expect(strip[3]).toMatchObject({ day: "2026-10-08", done: true });
    expect(strip[4]).toMatchObject({
      day: "2026-10-09",
      isToday: true,
      done: false,
    });
  });
});
