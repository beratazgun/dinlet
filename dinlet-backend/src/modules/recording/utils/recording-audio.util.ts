/** Kayıt klibi olarak kabul edilen ses türleri ve dosya uzantıları. */
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/3gpp": "3gp",
  "audio/ogg": "ogg",
};

export const MAX_CLIP_BYTES = 15 * 1_024 * 1_024;
export const MIN_CLIP_MS = 300;
export const MAX_CLIP_MS = 10 * 60 * 1_000;

/** Kabul edilmeyen türde `null`. */
export function audioExtension(mimeType: string): string | null {
  return AUDIO_EXTENSIONS[mimeType.toLowerCase().split(";")[0]!.trim()] ?? null;
}

export interface RecordingPart {
  position: number;
  kind: "PARAGRAPH" | "RECAP";
  text: string;
}

/** Bölümün kaydedilecek parçaları: paragraflar, varsa en sonda özet. */
export function recordingParts(
  script: { paragraphs: string[]; recap: string | null } | null,
): RecordingPart[] {
  if (!script) return [];
  const parts: RecordingPart[] = script.paragraphs.map((text, position) => ({
    position,
    kind: "PARAGRAPH",
    text,
  }));
  if (script.recap) {
    parts.push({ position: parts.length, kind: "RECAP", text: script.recap });
  }
  return parts;
}

/** Bölümün kendi önekinde, tahmin edilemez anahtar (not silinince temizlenir). */
export function recordingPrefix(input: {
  userId: number;
  documentId: number;
  storagePrefix: string;
  sectionId: number;
}): string {
  return `audio/${input.userId}/${input.documentId}-${input.storagePrefix}/rec-${input.sectionId}`;
}
