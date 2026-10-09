/**
 * Kayıt birleştirme işi. `tts` kuyruğunda `mix` adıyla Python worker
 * tarafından tüketilir; `dinlet-worker/main.py` (`Handlers._mix`) ile
 * birebir aynı tutulmalıdır.
 */
export const RECORDING_MIX_JOB = "mix";

/** jobId: `mix-{recordingId}-{mixRun}` */
export interface RecordingMixJobData {
  recordingId: number;
  userId: number;
  /** Birleşik MP3'ün yazılacağı R2 anahtarı. */
  audioKey: string;
  /** Tekrar özetinin sırası (önüne daha uzun ara konur); yoksa `null`. */
  recapPosition: number | null;
  clips: { position: number; audioKey: string }[];
}

export interface RecordingMixJobResult {
  audioKey: string;
  durationMs: number;
  sizeBytes: number;
  clips: { position: number; startMs: number; durationMs: number }[];
}

export function recordingMixJobId(recordingId: number, run: number): string {
  return `mix-${recordingId}-${run}`;
}

export function parseRecordingMixJobId(
  jobId: string,
): { recordingId: number; run: number } | null {
  const match = /^mix-(\d+)-(\d+)$/.exec(jobId);
  return match
    ? { recordingId: Number(match[1]), run: Number(match[2]) }
    : null;
}
