import { Directory, File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import type { DownloadedDocument, DownloadManifest } from "./types";

const MANIFEST_STORAGE_KEY = "dinlet.downloads.manifest.v1";
const DOWNLOADS_DIR_NAME = "dinlet_downloads";

export function getDownloadsDirectory(): Directory {
  const dir = new Directory(Paths.document, DOWNLOADS_DIR_NAME);
  if (!dir.exists) {
    try {
      dir.create({ idempotent: true });
    } catch {
      // directory creation handled idempotently
    }
  }
  return dir;
}

export function getSectionAudioFile(documentId: number, sectionId: number): File {
  const dir = getDownloadsDirectory();
  return new File(dir, `doc_${documentId}_sec_${sectionId}.mp3`);
}

export async function loadDownloadsManifest(): Promise<DownloadedDocument[]> {
  try {
    const raw = await SecureStore.getItemAsync(MANIFEST_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as DownloadManifest;
    if (!parsed || !Array.isArray(parsed.documents)) return [];

    // Dosyaların diskte gerçekten var olduğunu doğrula
    const validDocuments: DownloadedDocument[] = [];
    for (const doc of parsed.documents) {
      const validSections = doc.sections.filter((s) => {
        try {
          const file = new File(s.localUri);
          return file.exists;
        } catch {
          return false;
        }
      });

      if (validSections.length > 0) {
        const totalByteSize = validSections.reduce((sum, s) => sum + s.byteSize, 0);
        validDocuments.push({
          ...doc,
          sections: validSections,
          totalByteSize,
        });
      }
    }

    if (validDocuments.length !== parsed.documents.length) {
      await saveDownloadsManifest(validDocuments);
    }

    return validDocuments;
  } catch (error) {
    console.warn("[downloads-storage] Failed to load manifest:", error);
    return [];
  }
}

export async function saveDownloadsManifest(documents: DownloadedDocument[]): Promise<void> {
  const manifest: DownloadManifest = {
    version: 1,
    documents,
  };
  try {
    await SecureStore.setItemAsync(MANIFEST_STORAGE_KEY, JSON.stringify(manifest));
  } catch (error) {
    console.warn("[downloads-storage] Failed to save manifest:", error);
  }
}

export async function removeDocumentFiles(doc: DownloadedDocument): Promise<void> {
  for (const section of doc.sections) {
    try {
      const file = new File(section.localUri);
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      console.warn(`[downloads-storage] Failed to delete file for section ${section.id}:`, error);
    }
  }
}

export function calculateTotalBytes(documents: DownloadedDocument[]): number {
  return documents.reduce((sum, d) => sum + (d.totalByteSize || 0), 0);
}
