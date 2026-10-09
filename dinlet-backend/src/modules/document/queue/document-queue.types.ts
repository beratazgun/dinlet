/**
 * Belge işleme kuyruklarının sözleşmesi. `extract` ve `tts` kuyruklarını
 * Python worker (`dinlet-worker/`) tüketir; bu tipler worker'daki
 * karşılıklarıyla birebir aynı tutulmalıdır.
 */

export const DocumentJobName = {
  EXTRACT: "extract",
  PROCESS: "process",
  SYNTHESIZE: "synthesize",
  /** Hızlı tekrar metinleri (LLM) — `quick-{documentId}-{run}`. */
  QUICK: "quick",
  /** Hafıza kancası önerileri (LLM) — `mnem-{documentId}-{run}`. */
  MNEMONICS: "mnemonics",
} as const;

/** `extract` job'u — jobId: `extract-{documentId}`. */
export interface ExtractJobData {
  documentId: number;
  /** R2'deki PDF. */
  pdfKey: string;
  /** Markdown çıktısının yazılacağı R2 anahtarı. */
  extractedKey: string;
  pageCount: number;
}

/** `extract` job'unun dönüş değeri. */
export interface ExtractJobResult {
  extractedKey: string;
  chars: number;
  ocrPages: number;
}

/** `document-process` job'u — jobId: `doc-{documentId}[-retry-n]`. */
export interface DocumentProcessJobData {
  documentId: number;
}

/** `tts` job'u — jobId: `tts-{sectionId}-{scriptHash}-{attempt}`. */
export interface TtsJobData {
  sectionId: number;
  documentId: number;
  userId: number;
  /** Bölüm başlığı; seslendirmenin başında okunur. */
  title: string;
  paragraphs: string[];
  recap: string | null;
  /** MP3'ün yazılacağı R2 anahtarı (tahmin edilemez önek içerir). */
  audioKey: string;
  sampleRate: number;
  /**
   * Bölüm sesinden ayrı, kısa sesler: tekrar özeti, sorular ve cevaplar
   * (aralıklı tekrar). Her biri kendi anahtarına ayrı MP3 olarak yazılır.
   */
  clips?: TtsClip[];
  /** Yalnızca klipler seslendirilir (bölüm sesi yok; ör. hafıza kancası). */
  clipsOnly?: boolean;
}

export interface TtsClip {
  audioKey: string;
  text: string;
}

/** `tts` job'unun dönüş değeri. */
export interface TtsJobResult {
  audioKey: string;
  durationMs: number;
  sizeBytes: number;
  clips?: { audioKey: string; durationMs: number }[];
}
