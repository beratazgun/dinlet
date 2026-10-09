/** Depolamaya yüklenmiş ve kaydı tamamlanmış dosya. */
export interface Media {
  id: number;
  /** Bucket adı içermeyen nesne anahtarı; URL'e response DTO'da çevrilir. */
  storageKey: string;
  fileName: string;
  mimeType: string;
  /** Bayt */
  size: number;
  uploaderId: number | null;
  /** ISO 8601 */
  createdAt: string;
}

export interface NewMedia {
  storageKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploaderId: number;
}
