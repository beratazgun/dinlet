import { File } from "expo-file-system";
import NetInfo from "@react-native-community/netinfo";
import { resolveAudioUrl } from "@/lib/audio-url";
import { getUserSettings } from "@/lib/settings-storage";
import type { GetDocumentApiResponse } from "@/networks/api/documents/documents";
import { getSectionAudioFile } from "./downloads-storage";
import type { DownloadedDocument, DownloadedSection, InFlightDownload } from "./types";

export type DocumentDetail = NonNullable<GetDocumentApiResponse["Data"]>;

export async function checkCanDownload(): Promise<{ allowed: boolean; reason?: string }> {
  const settings = getUserSettings();
  if (!settings.downloadOnlyOnWifi) {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      return {
        allowed: false,
        reason: "İnternet bağlantısı bulunamadı.",
      };
    }
    return { allowed: true };
  }

  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    return {
      allowed: false,
      reason: "İnternet bağlantısı bulunamadı.",
    };
  }

  if (net.type !== "wifi") {
    return {
      allowed: false,
      reason:
        "Yalnızca Wi‑Fi ile indirme açık. Notu indirmek için Wi‑Fi ağına bağlanabilir veya ayarı kapatabilirsin.",
    };
  }

  return { allowed: true };
}

export async function downloadDocumentSections(
  document: DocumentDetail,
  options: {
    signal: AbortSignal;
    onProgress: (inFlight: InFlightDownload) => void;
  }
): Promise<DownloadedDocument> {
  const allSections = document.sections ?? [];
  const readySections = allSections.filter(
    (s) => s.audioUrl && (s.status?.raw === "READY" || !s.status)
  );

  if (readySections.length === 0) {
    throw new Error("Bu notta indirilebilecek hazır ses kaydı bulunmuyor.");
  }

  const downloadedSections: DownloadedSection[] = [];
  const totalCount = readySections.length;

  for (let index = 0; index < totalCount; index++) {
    if (options.signal.aborted) {
      throw new Error("İndirme iptal edildi.");
    }

    const section = readySections[index];
    const resolvedUrl = resolveAudioUrl(section.audioUrl);
    if (!resolvedUrl) {
      continue;
    }

    const targetFile = getSectionAudioFile(document.id, section.id);

    // Başlangıç ilerlemesi bildir
    options.onProgress({
      documentId: document.id,
      documentTitle: document.title,
      totalSections: totalCount,
      completedSections: index,
      progressPercent: Math.round((index / totalCount) * 100),
      status: "downloading",
    });

    try {
      await File.downloadFileAsync(resolvedUrl, targetFile, {
        idempotent: true,
        signal: options.signal,
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (totalBytes > 0) {
            const currentSectionRatio = bytesWritten / totalBytes;
            const overallPercent = Math.round(
              ((index + currentSectionRatio) / totalCount) * 100
            );
            options.onProgress({
              documentId: document.id,
              documentTitle: document.title,
              totalSections: totalCount,
              completedSections: index,
              progressPercent: Math.min(99, Math.max(0, overallPercent)),
              status: "downloading",
            });
          }
        },
      });

      const fileInfo = targetFile.info();
      const byteSize = fileInfo.size ?? targetFile.size ?? 0;

      downloadedSections.push({
        id: section.id,
        order: section.order,
        title: section.title,
        durationMs: section.durationMs ?? null,
        localUri: targetFile.uri,
        byteSize,
      });
    } catch (err: unknown) {
      if (options.signal.aborted) {
        throw new Error("İndirme iptal edildi.");
      }
      console.warn(`[downloads-service] Section ${section.id} download error:`, err);
    }
  }

  if (downloadedSections.length === 0) {
    throw new Error("Bölümler indirilemedi. Bağlantını kontrol edip tekrar dene.");
  }

  const totalByteSize = downloadedSections.reduce((acc, s) => acc + s.byteSize, 0);

  return {
    id: document.id,
    title: document.title,
    pageCount: document.pageCount,
    totalDurationMs: document.totalDurationMs ?? null,
    totalByteSize,
    sections: downloadedSections,
    downloadedAt: Date.now(),
  };
}
