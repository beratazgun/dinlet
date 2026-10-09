/**
 * Kapsam güvencesi: notun (bölümün kaynak metni) tarih, sayı ve özel
 * isimlerinin anlatımda geçip geçmediği. LLM'siz, kural tabanlıdır; anlatım
 * sayıları yazıyla söylediği için sayılar hem rakam hem okunuşla aranır.
 */

export type FactKind = "date" | "number" | "name";

export interface SourceFact {
  kind: FactKind;
  /** Notta geçtiği biçim ("1299", "Alaeddin Paşa"). */
  term: string;
  /** Geçtiği satır (kısaltılmış). */
  snippet: string;
}

const ONES = [
  "",
  "bir",
  "iki",
  "üç",
  "dört",
  "beş",
  "altı",
  "yedi",
  "sekiz",
  "dokuz",
];
const TENS = [
  "",
  "on",
  "yirmi",
  "otuz",
  "kırk",
  "elli",
  "altmış",
  "yetmiş",
  "seksen",
  "doksan",
];
const SCALES: [number, string][] = [
  [1_000_000_000, "milyar"],
  [1_000_000, "milyon"],
  [1_000, "bin"],
];

function belowThousand(n: number): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  if (hundreds > 0) {
    if (hundreds > 1) words.push(ONES[hundreds]!);
    words.push("yüz");
  }
  const rest = n % 100;
  if (rest >= 10) words.push(TENS[Math.floor(rest / 10)]!);
  if (rest % 10 > 0) words.push(ONES[rest % 10]!);
  return words;
}

/** Tam sayının Türkçe okunuşu: 1299 → "bin iki yüz doksan dokuz". */
export function numberToTurkishWords(value: number): string {
  if (!Number.isInteger(value) || value < 0) return String(value);
  if (value === 0) return "sıfır";
  const words: string[] = [];
  let rest = value;
  for (const [size, name] of SCALES) {
    const count = Math.floor(rest / size);
    if (count === 0) continue;
    // "bin" tek başına söylenir ("bir bin" değil); milyon ve milyar sayıyla.
    if (!(size === 1_000 && count === 1)) words.push(...belowThousand(count));
    words.push(name);
    rest %= size;
  }
  words.push(...belowThousand(rest));
  return words.join(" ");
}

/** Cümle başındaki büyük harfli sıradan kelimeler isim sayılmasın. */
const NOT_NAMES = new Set(
  [
    "bu",
    "bir",
    "ve",
    "ile",
    "ancak",
    "fakat",
    "ama",
    "çünkü",
    "bunun",
    "buna",
    "bunlar",
    "şu",
    "o",
    "her",
    "hem",
    "ya",
    "da",
    "de",
    "için",
    "gibi",
    "en",
    "daha",
    "sonra",
    "önce",
    "ayrıca",
    "böylece",
    "ilk",
    "son",
    "yani",
    "örneğin",
    "not",
    "özet",
    "konu",
    "bölüm",
    "sayfa",
    "tablo",
    "şekil",
    "soru",
    "cevap",
    "kaynak",
    "madde",
  ].map((word) => word.toLocaleLowerCase("tr-TR")),
);

const UPPER = "A-ZÇĞİÖŞÜÂÎÛ";
const LOWER = "a-zçğıöşüâîû";
const NAME_PATTERN = new RegExp(
  `[${UPPER}][${LOWER}]+(?:\\s+[${UPPER}][${LOWER}]+)*`,
  "gu",
);
const NUMBER_PATTERN = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;
const MAX_SNIPPET = 120;

function snippetOf(line: string): string {
  const text = line.replace(/^[\s#>*•\-–]+/, "").trim();
  return text.length > MAX_SNIPPET
    ? `${text.slice(0, MAX_SNIPPET - 1)}…`
    : text;
}

/** Kaynak metindeki tarih, sayı ve özel isimler (bölüm içinde tekil). */
export function extractFacts(sourceText: string): SourceFact[] {
  const facts = new Map<string, SourceFact>();
  const add = (fact: SourceFact) => {
    const key = `${fact.kind}:${fact.term.toLocaleLowerCase("tr-TR")}`;
    if (!facts.has(key)) facts.set(key, fact);
  };

  let inCodeBlock = false;
  for (const rawLine of sourceText.split("\n")) {
    const line = rawLine.trim();

    // Kod bloklarını (``` veya ~~~ ile başlayan/biten) atla
    if (line.startsWith("```") || line.startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Başlıklar bölüm başlığı olarak ayrıca okunur.
    if (!line || line.startsWith("#")) continue;
    const snippet = snippetOf(line);
    const cleanLine = line.replace(/`[^`]*`/g, " ");

    for (const match of cleanLine.matchAll(NUMBER_PATTERN)) {
      const digits = match[0].replace(/\.(?=\d{3})/g, "");
      if (digits.includes(",")) {
        add({ kind: "number", term: match[0], snippet });
        continue;
      }
      const value = Number(digits);
      if (value >= 1000 && value <= 2100 && digits.length === 4) {
        add({ kind: "date", term: digits, snippet });
      } else if (value >= 10) {
        // Tek haneli sayılar ("1.", "3 madde") her yerde geçer; ölçüt dışı.
        add({ kind: "number", term: digits, snippet });
      }
    }

    for (const match of cleanLine.matchAll(NAME_PATTERN)) {
      const index = match.index ?? 0;
      const before = cleanLine.slice(0, index).trimEnd();
      // İki nokta cümle sonu sayılmaz: notlarda tanımın veya ismin önündedir.
      const sentenceStart = before === "" || /[.!?•*\-–(]$/.test(before);
      const rawWords = match[0].split(/\s+/);
      // Cümle başındaki tek kelime büyük harfle başladığı için isim sayılmaz.
      if (sentenceStart && rawWords.length === 1) continue;
      const words = rawWords.filter(
        (word) => !NOT_NAMES.has(word.toLocaleLowerCase("tr-TR")),
      );
      if (words.length === 0) continue;
      const name = words.join(" ");
      if (name.length >= 3) add({ kind: "name", term: name, snippet });
    }
  }
  return [...facts.values()];
}

function normalizeForSearch(text: string): string {
  return text.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

/** Anlatım metni bu bilgiyi içeriyor mu? */
export function isFactCovered(fact: SourceFact, scriptText: string): boolean {
  const script = normalizeForSearch(scriptText);
  if (fact.kind === "name") {
    return fact.term
      .split(/\s+/)
      .every((word) => script.includes(word.toLocaleLowerCase("tr-TR")));
  }
  if (script.includes(fact.term.toLocaleLowerCase("tr-TR"))) return true;
  const [whole, fraction] = fact.term.replace(/\./g, "").split(",");
  let spoken = numberToTurkishWords(Number(whole));
  if (fraction) spoken += ` virgül ${numberToTurkishWords(Number(fraction))}`;
  return script.includes(spoken);
}
