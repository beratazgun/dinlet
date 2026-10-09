import { describe, expect, it } from "vitest";

import { DateManager } from "#/core/utils/date-manager.js";

describe("DateManager.nextPeriodStart", () => {
  const dateManager = new DateManager();

  it("bir sonraki ayın 1'ini İstanbul gece yarısı olarak verir", () => {
    expect(
      dateManager
        .nextPeriodStart(new Date("2026-10-15T12:00:00Z"))
        .toISOString(),
    ).toBe("2026-10-31T21:00:00.000Z");
  });

  it("aralıktan sonra yılı ilerletir", () => {
    expect(
      dateManager
        .nextPeriodStart(new Date("2026-12-20T09:00:00Z"))
        .toISOString(),
    ).toBe("2026-12-31T21:00:00.000Z");
  });

  it("dönemi İstanbul saatine göre belirler (UTC'de hâlâ önceki ay)", () => {
    // 31 Ekim 22:30 UTC = 1 Kasım 01:30 İstanbul → dönem Kasım, yenilenme 1 Aralık.
    expect(
      dateManager
        .nextPeriodStart(new Date("2026-10-31T22:30:00Z"))
        .toISOString(),
    ).toBe("2026-11-30T21:00:00.000Z");
  });
});
