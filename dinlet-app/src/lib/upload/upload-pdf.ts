import { File, UploadTask, type UploadProgress } from "expo-file-system";
import { completeUploadApi, createUploadApi } from "@/networks/api/media/media";

export const PDF_MIME_TYPE = "application/pdf";

export class UploadError extends Error {}

export interface PickedPdf {
  uri: string;
  name: string;
  size: number;
}

/**
 * PDF'i API'den geçirmeden yükler: imzalı `PUT` URL'i alınır, dosya R2'ye
 * doğrudan gönderilir, sonra yükleme tamamlanır (backend türü ve boyutu
 * doğrular). Dönen medya ID'si not oluştururken kullanılır.
 */
export async function uploadPdf(
  pdf: PickedPdf,
  options: { onProgress?: (ratio: number) => void; signal?: AbortSignal } = {}
): Promise<number> {
  const ticket = await createUploadApi({
    fileName: pdf.name,
    mimeType: PDF_MIME_TYPE,
    size: pdf.size,
  });
  const { uploadId, uploadUrl, headers } = ticket.data;

  const task = new UploadTask(new File(pdf.uri), uploadUrl, {
    httpMethod: "PUT",
    headers,
    mimeType: PDF_MIME_TYPE,
    // Ekran açıkken yükleniyor; ilerleme ve iptal JS tarafında kalsın.
    sessionType: "foreground",
    signal: options.signal,
    onProgress: ({ bytesSent, totalBytes }: UploadProgress) => {
      if (totalBytes > 0) options.onProgress?.(bytesSent / totalBytes);
    },
  });

  try {
    const result = await task.uploadAsync();
    if (result.status < 200 || result.status >= 300) {
      throw new UploadError("Dosya yüklenemedi. Bağlantını kontrol edip tekrar dene.");
    }
  } finally {
    task.release();
  }

  const completed = await completeUploadApi({ uploadId });
  return completed.data.id;
}
