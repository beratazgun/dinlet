import { createHash } from "node:crypto";

import type { SectionScript } from "#/modules/document/types/index.js";

const BULLET = /^\s*(?:[-*+•▪◦●○–]|\d{1,3}[.)]|[a-zçğıöşü][.)])\s+/i;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const TERMINAL_PUNCTUATION = /[.!?…:;]$/;

/**
 * Free yolu: bölümün Markdown metnini LLM kullanmadan okunabilir paragraflara
 * çevirir. Madde işaretleri kaldırılır ve her madde ayrı cümle olarak okunur;
 * tablo satırları virgülle birleştirilir; Markdown işaretleri temizlenir.
 * Sayı ve kısaltmaların okunuşu TTS worker'daki normalizasyona kalır.
 */
export function buildRawScript(markdown: string): SectionScript {
  const paragraphs: string[] = [];

  for (const block of markdown.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const sentences = block
      .split("\n")
      .map(lineToSentence)
      .filter((sentence): sentence is string => sentence !== null);
    if (sentences.length > 0) paragraphs.push(sentences.join(" "));
  }

  return { paragraphs, recap: null };
}

function lineToSentence(line: string): string | null {
  if (TABLE_SEPARATOR.test(line) || /^\s*```/.test(line)) return null;

  let text = line.trim();
  if (!text || /^!\[[^\]]*\]\([^)]*\)$/.test(text)) return null;

  const isTableRow = text.startsWith("|") && text.endsWith("|");
  if (isTableRow) {
    text = text
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(", ");
  }

  text = stripInlineMarkdown(
    text.replace(/^#{1,6}\s+/, "").replace(/^>\s?/, "").replace(BULLET, ""),
  );
  if (!text) return null;

  return TERMINAL_PUNCTUATION.test(text) ? text : `${text}.`;
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/(\*\*|__|\*|_|`|~~)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Metnin içerik özeti. TTS job kimliğinde ve ses dosyası anahtarında
 * kullanılır: metin değişirse anahtar da değişir (CDN önbelleği `immutable`).
 */
export function hashScript(script: SectionScript): string {
  // Sorular yalnızca varsa karışır; sorusuz metinlerin özeti değişmez.
  const parts: unknown[] = [script.paragraphs, script.recap];
  if (script.questions?.length) parts.push(script.questions);
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 16);
}

/** Seslendirilecek toplam karakter (ilerleme hesabı için). */
export function scriptLength(script: SectionScript): number {
  return (
    script.paragraphs.reduce((total, paragraph) => total + paragraph.length, 0) +
    (script.recap?.length ?? 0)
  );
}
