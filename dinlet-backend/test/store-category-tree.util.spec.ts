import { describe, expect, it } from "vitest";

import { buildCategoryTree } from "#/modules/store/utils/index.js";

const category = (id: number, parentId: number | null, name: string) => ({
  id,
  parentId,
  slug: name.toLowerCase(),
  name,
  position: 0,
});

describe("Mağaza kategori ağacı", () => {
  it("dersleri sınavlarının altına sırasını koruyarak dizer", () => {
    const tree = buildCategoryTree([
      category(1, null, "KPSS"),
      category(2, null, "YKS"),
      category(3, 1, "Tarih"),
      category(4, 1, "Coğrafya"),
      category(5, 9, "Yetim"),
    ]);
    expect(
      tree.map((root) => [root.name, root.children.map((child) => child.name)]),
    ).toEqual([
      ["KPSS", ["Tarih", "Coğrafya"]],
      ["YKS", []],
    ]);
  });
});
