export interface StoreCategoryNode {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
  position: number;
}

/**
 * Düz kategori listesini sınav → ders ağacına çevirir. Liste sıralı gelir
 * (`position`, `id`); sıra korunur. Üst kategorisi bulunamayan ders kökte
 * gösterilmez.
 */
export function buildCategoryTree<T extends StoreCategoryNode>(
  categories: T[],
): (T & { children: T[] })[] {
  const roots = categories
    .filter((category) => category.parentId === null)
    .map((root) => ({ ...root, children: [] as T[] }));
  const rootById = new Map(roots.map((root) => [root.id, root]));
  for (const category of categories) {
    if (category.parentId !== null) {
      rootById.get(category.parentId)?.children.push(category);
    }
  }
  return roots;
}
