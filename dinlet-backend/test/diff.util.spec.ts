import { describe, expect, it } from "vitest";

import { calculateDiff } from "#/core/utils/diff.util.js";

describe("calculateDiff", () => {
  it("should return empty array when both before and after are undefined or null", () => {
    expect(calculateDiff(null, null)).toEqual([]);
    expect(calculateDiff(undefined, undefined)).toEqual([]);
  });

  it("should detect primitive field changes", () => {
    const before = { name: "Job A", isActive: false, count: 5 };
    const after = { name: "Job B", isActive: true, count: 5 };

    const diff = calculateDiff(before, after);

    expect(diff).toEqual([
      { field: "name", old: "Job A", new: "Job B" },
      { field: "isActive", old: false, new: true },
    ]);
  });

  it("should ignore fields specified in exclude option", () => {
    const before = { name: "A", updatedAt: "2026-01-01" };
    const after = { name: "B", updatedAt: "2026-01-02" };

    const diff = calculateDiff(before, after, { exclude: ["updatedAt"] });

    expect(diff).toEqual([{ field: "name", old: "A", new: "B" }]);
  });

  it("should detect object and array differences correctly", () => {
    const before = { tags: ["a", "b"], config: { timeout: 100 } };
    const after = { tags: ["a", "c"], config: { timeout: 200 } };

    const diff = calculateDiff(before, after);

    expect(diff).toEqual([
      { field: "tags", old: ["a", "b"], new: ["a", "c"] },
      { field: "config", old: { timeout: 100 }, new: { timeout: 200 } },
    ]);
  });
});
