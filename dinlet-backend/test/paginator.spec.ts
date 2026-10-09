import { describe, expect, it } from "vitest";

import {
  type CursorWindow,
  MAX_PAGE_LIMIT,
  Paginator,
  type SeekKey,
} from "#/core/utils/paginator.js";
import { BadRequestException } from "@nestjs/common";

/** `(createdAt, id)` azalan sırada 1..total arası kayıtlar; `query` gerçek keyset'i taklit eder. */
function seekSource(total: number) {
  const rows: SeekKey[] = Array.from({ length: total }, (_, index) => ({
    // Her iki kayıt aynı zaman damgasını paylaşır: id eşitliği bozar.
    createdAt: `2026-10-04 12:00:${String(Math.floor(index / 2)).padStart(2, "0")}.123456+00`,
    id: index + 1,
  })).reverse();
  const windows: CursorWindow[] = [];

  const query = (window: CursorWindow) => {
    windows.push(window);
    const after = window.after;
    const start = after
      ? rows.findIndex(
          (row) =>
            row.createdAt < after.createdAt ||
            (row.createdAt === after.createdAt && row.id < after.id),
        )
      : 0;
    return Promise.resolve(
      start === -1 ? [] : rows.slice(start, start + window.limit),
    );
  };

  return { query, windows };
}

describe("Paginator.applyCursor", () => {
  const paginator = new Paginator();

  it("walks every row exactly once without counting", async () => {
    const { query } = seekSource(45);
    const seen: number[] = [];
    let cursor: string | undefined;
    let pages = 0;

    do {
      const { docs, pagination } = await paginator.applyCursor({
        cursor,
        limit: 20,
        query,
      });
      seen.push(...docs.map((doc) => doc.id));
      cursor = pagination.nextCursor ?? undefined;
      pages++;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toEqual(Array.from({ length: 45 }, (_, i) => 45 - i));
  });

  it("asks for limit + 1 and reports no next page on an exact fit", async () => {
    const { query, windows } = seekSource(20);
    const { docs, pagination } = await paginator.applyCursor({
      limit: 20,
      query,
    });

    expect(windows[0]).toEqual({ limit: 21, after: null });
    expect(docs).toHaveLength(20);
    expect(pagination).toEqual({
      kind: "cursor",
      limit: 20,
      nextCursor: null,
      hasNextPage: false,
    });
  });

  it("clamps limit to MAX_PAGE_LIMIT", async () => {
    const { query, windows } = seekSource(1);
    await paginator.applyCursor({ limit: 10_000, query });
    expect(windows[0]?.limit).toBe(MAX_PAGE_LIMIT + 1);
  });

  it("rejects a tampered cursor as invalid input", async () => {
    const { query } = seekSource(1);
    const forged = Buffer.from(
      JSON.stringify(["'; DROP TABLE audit_logs; --", 1]),
    ).toString("base64url");

    for (const cursor of ["not-base64-json", forged]) {
      await expect(paginator.applyCursor({ cursor, query })).rejects.toThrow(
        BadRequestException,
      );
    }
  });
});

describe("Paginator.apply", () => {
  const paginator = new Paginator();

  it("clamps limit and builds offset meta", async () => {
    const { pagination } = await paginator.apply({
      page: 2,
      limit: 10_000,
      count: () => Promise.resolve(250),
      query: () => Promise.resolve([]),
    });

    expect(pagination).toMatchObject({
      kind: "offset",
      page: 2,
      limit: MAX_PAGE_LIMIT,
      totalPages: 3,
      nextPage: 3,
      prevPage: 1,
    });
  });
});
