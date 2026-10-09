export interface DownloadedSection {
  id: number;
  order: number;
  title: string;
  durationMs: number | null;
  localUri: string;
  byteSize: number;
}

export interface DownloadedDocument {
  id: number;
  title: string;
  pageCount: number;
  totalDurationMs: number | null;
  totalByteSize: number;
  sections: DownloadedSection[];
  downloadedAt: number;
}

export interface InFlightDownload {
  documentId: number;
  documentTitle: string;
  totalSections: number;
  completedSections: number;
  progressPercent: number;
  status: "downloading" | "paused" | "error";
  error?: string;
}

export interface DownloadManifest {
  version: number;
  documents: DownloadedDocument[];
}
