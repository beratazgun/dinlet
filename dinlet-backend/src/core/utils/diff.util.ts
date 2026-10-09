/**
 * İki nesne arasındaki alan bazlı değer farkını (diff) temsil eder.
 */
export interface AuditFieldChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface DiffOptions<T> {
  /** Karşılaştırmaya dahil edilmeyecek alanlar (ör. 'updatedAt'). */
  exclude?: (keyof T | string)[];
}

/**
 * İki nesneyi karşılaştırarak değişen alanların eski ve yeni değerlerini döner.
 *
 * @example
 * const diff = calculateDiff(
 *   { name: "Eski", count: 1 },
 *   { name: "Yeni", count: 1 }
 * );
 * // => [{ field: "name", old: "Eski", new: "Yeni" }]
 */
export function calculateDiff<T extends object>(
  before: T | null | undefined,
  after: T | null | undefined,
  options: DiffOptions<T> = {},
): AuditFieldChange[] {
  if (!before && !after) return [];

  const safeBefore = (before ?? {}) as Record<string, unknown>;
  const safeAfter = (after ?? {}) as Record<string, unknown>;
  const excludeSet = new Set<string>((options.exclude as string[]) ?? []);

  const keys = new Set([
    ...Object.keys(safeBefore),
    ...Object.keys(safeAfter),
  ]);

  const changes: AuditFieldChange[] = [];

  for (const key of keys) {
    if (excludeSet.has(key)) continue;

    const oldVal = safeBefore[key];
    const newVal = safeAfter[key];

    if (!isEqual(oldVal, newVal)) {
      changes.push({
        field: key,
        old: oldVal ?? null,
        new: newVal ?? null,
      });
    }
  }

  return changes;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (typeof a === "object" && typeof b === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  return false;
}
