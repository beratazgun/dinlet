/** Klasör renkleri: uygulamadaki seçicinin paleti (marka tonları önce). */
export const FOLDER_COLORS = [
  "#1928B4",
  "#2D40E5",
  "#96A6F9",
  "#1322A0",
  "#0E1238",
  "#B54708",
  "#0F7B6C",
  "#C11574",
] as const;

export type FolderColor = (typeof FOLDER_COLORS)[number];

/** Yeni klasöre sıradaki renk: kullanıcının mevcut klasör sayısına göre döner. */
export function nextFolderColor(existingCount: number): FolderColor {
  return FOLDER_COLORS[existingCount % FOLDER_COLORS.length]!;
}
