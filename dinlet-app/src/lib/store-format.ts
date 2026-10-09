import { formatDuration } from "@/lib/format";
import type { ListItemsApiResponse } from "@/networks/api/store/store";

export type StoreItem = NonNullable<ListItemsApiResponse["Data"]>[number];

/** Sınavlar (üst kategorisi olmayanlar) ve dersler. */
export function splitCategories(item: Pick<StoreItem, "categories">) {
  return {
    exams: item.categories.filter((category) => category.parentId === null),
    subjects: item.categories.filter((category) => category.parentId !== null),
  };
}

/** Liste kutucuğundaki kısaltma: ders adının ilk üç harfi ("TAR"). */
export function storeTag(item: StoreItem): string {
  const { subjects, exams } = splitCategories(item);
  const name = subjects[0]?.name ?? exams[0]?.name ?? item.title;
  return name.toLocaleUpperCase("tr-TR").replace(/[^A-ZÇĞİÖŞÜ0-9]/g, "").slice(0, 3);
}

/** "KPSS · 8 bölüm · Dinlet özgün" */
export function storeShortMeta(item: StoreItem): string {
  const { exams } = splitCategories(item);
  return [exams[0]?.name, `${item.sectionCount} bölüm`, item.source?.display]
    .filter(Boolean)
    .join(" · ");
}

/** "8 bölüm · 2 sa 10 dk · sorular dahil" */
export function storeLongMeta(item: StoreItem): string {
  return [
    `${item.sectionCount} bölüm`,
    item.totalDurationMs ? formatDuration(item.totalDurationMs) : null,
    item.questionCount > 0 ? "sorular dahil" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Kaynak rozeti: "Ortak yayınevi · Kitapyurdu" */
export function storeSourceLabel(item: StoreItem): string {
  const source = item.source?.display ?? "";
  return item.publisherName ? `${source} · ${item.publisherName}` : source;
}

/** Sağdaki fiyat etiketi: sahiplik > ücretsiz > fiyat. */
export function storePriceLabel(item: Pick<StoreItem, "isOwned" | "isFree" | "price">): string {
  if (item.isOwned) return "Sahipsin";
  if (item.isFree) return "Ücretsiz";
  return item.price?.display ?? "Satın al";
}
