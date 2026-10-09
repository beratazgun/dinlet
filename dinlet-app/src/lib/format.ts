/** "2 sa 24 dk", "38 dk", "45 sn" */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return `${Math.max(1, Math.round(ms / 1000))} sn`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} dk`;
  return minutes === 0 ? `${hours} sa` : `${hours} sa ${minutes} dk`;
}

/** Oynatıcı saati: "5:25", "1:02:09" */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** "6,2 MB", "820 KB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

/**
 * Bulunma eki (ünlü uyumu ve sert ünsüz benzeşmesi): "1 Kasım" → "1 Kasım'da",
 * "1 Aralık" → "1 Aralık'ta", "1 Ekim" → "1 Ekim'de".
 */
export function withLocative(word: string): string {
  const lower = word.toLocaleLowerCase("tr-TR");
  const lastVowel = [...lower].reverse().find((char) => "aeıioöuü".includes(char));
  const front = lastVowel !== undefined && "eiöü".includes(lastVowel);
  const hard = "çfhkpsşt".includes(lower.at(-1) ?? "");
  return `${word}'${hard ? "t" : "d"}${front ? "e" : "a"}`;
}

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];

/** Sayının okunuşundaki son kelime (ek uyumu için): 7 → "yedi", 40 → "kırk". */
function lastSpokenWord(n: number): string {
  if (n === 0) return "sıfır";
  if (n % 10 !== 0) return ONES[n % 10]!;
  if (n % 100 !== 0) return TENS[(n % 100) / 10]!;
  if (n % 1000 !== 0) return "yüz";
  return "bin";
}

/**
 * İyelik + belirtme eki: 7 → "7'sini", 3 → "3'ünü", 6 → "6'sını",
 * 9 → "9'unu" ("12 belgenin 7'sini bitirdin").
 */
export function withPossessiveAccusative(n: number): string {
  const word = lastSpokenWord(Math.abs(Math.trunc(n)));
  const lastVowel = [...word].reverse().find((char) => "aeıioöuü".includes(char)) ?? "e";
  const vowel = "aı".includes(lastVowel)
    ? "ı"
    : "ei".includes(lastVowel)
      ? "i"
      : "ou".includes(lastVowel)
        ? "u"
        : "ü";
  const endsWithVowel = "aeıioöuü".includes(word.at(-1)!);
  return `${n}'${endsWithVowel ? "s" : ""}${vowel}n${vowel}`;
}
