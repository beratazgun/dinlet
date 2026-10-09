/** Docling Markdown'ından çıkarılan, seslendirilecek bir bölüm. */
export interface SplitSection {
  title: string;
  /** Bölümün ham Markdown metni (başlık satırı hariç). */
  text: string;
}

export interface SplitOptions {
  /** Bölüm bu uzunluğu aşarsa paragraf sınırından parçalanır. */
  targetChars: number;
  /** Bu uzunluğun altındaki bölüm bir öncekiyle birleştirilir. */
  minChars: number;
  /** Başlıksız metinde parçalara verilecek başlığın kökü. */
  fallbackTitle: string;
}

export const DEFAULT_SPLIT_OPTIONS: SplitOptions = {
  targetChars: 4_000,
  minChars: 400,
  fallbackTitle: "Bölüm",
};

/** Bölüm sınırı sayılan başlıklar: `#` ve `##`. Alt başlıklar içerikte kalır. */
const SECTION_HEADING = /^(#{1,2})\s+(.+?)\s*#*\s*$/;
const SENTENCE_END = /(?<=[.!?…])\s+/;

/**
 * Markdown'ı seslendirilecek bölümlere ayırır (kural tabanlı, LLM yok):
 *
 * 1. `#` / `##` başlıkları bölüm sınırıdır; başlıktan önceki metin ilk bölüm olur.
 * 2. `targetChars`'ı aşan bölüm paragraf sınırından (gerekirse cümle
 *    sınırından) yaklaşık `targetChars`'lık parçalara bölünür.
 * 3. `minChars`'ın altındaki bölüm, başlığıyla birlikte bir öncekine eklenir.
 * 4. Boş bölümler atılır.
 */
export function splitMarkdownIntoSections(
  markdown: string,
  options: Partial<SplitOptions> = {},
): SplitSection[] {
  const config = { ...DEFAULT_SPLIT_OPTIONS, ...options };
  const raw = splitByHeadings(markdown);

  const chunked = raw.flatMap((section) =>
    chunkSection(section, config.targetChars),
  );
  const merged = mergeShortSections(chunked, config.minChars);

  let untitled = 0;
  return merged.map((section) => ({
    title: section.title ?? `${config.fallbackTitle} ${++untitled}`,
    text: section.text,
  }));
}

interface RawSection {
  title: string | null;
  text: string;
}

function splitByHeadings(markdown: string): RawSection[] {
  const sections: RawSection[] = [];
  let current: { title: string | null; lines: string[] } = {
    title: null,
    lines: [],
  };

  const flush = () => {
    const text = current.lines.join("\n").trim();
    if (text) sections.push({ title: current.title, text });
  };

  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = SECTION_HEADING.exec(line);
    if (heading) {
      flush();
      current = { title: cleanInline(heading[2]!), lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  flush();

  return sections;
}

function chunkSection(section: RawSection, targetChars: number): RawSection[] {
  if (section.text.length <= targetChars * 1.25) return [section];

  const units = paragraphs(section.text).flatMap((paragraph) =>
    paragraph.length > targetChars ? sentences(paragraph, targetChars) : [paragraph],
  );

  const chunks: string[] = [];
  let buffer: string[] = [];
  let size = 0;
  for (const unit of units) {
    if (size > 0 && size + unit.length > targetChars) {
      chunks.push(buffer.join("\n\n"));
      buffer = [];
      size = 0;
    }
    buffer.push(unit);
    size += unit.length + 2;
  }
  if (buffer.length > 0) chunks.push(buffer.join("\n\n"));

  if (chunks.length === 1) return [section];
  return chunks.map((text, index) => ({
    title: section.title
      ? `${section.title} (${index + 1}/${chunks.length})`
      : null,
    text,
  }));
}

/** Kısa bölümleri bir öncekine ekler; ilk bölüm kısaysa sonrakine katılır. */
function mergeShortSections(
  sections: RawSection[],
  minChars: number,
): RawSection[] {
  const result: RawSection[] = [];
  let carry: RawSection | null = null;

  for (const section of sections) {
    const current: RawSection = carry
      ? {
          title: carry.title ?? section.title,
          text: `${carry.text}\n\n${withHeading(section)}`,
        }
      : section;
    carry = null;

    if (current.text.length >= minChars) {
      result.push(current);
      continue;
    }

    const previous = result.at(-1);
    if (previous) {
      previous.text = `${previous.text}\n\n${withHeading(current)}`;
    } else {
      carry = current;
    }
  }
  if (carry) result.push(carry);

  return result;
}

function withHeading(section: RawSection): string {
  return section.title ? `### ${section.title}\n\n${section.text}` : section.text;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** Tek başına çok uzun paragrafı cümle sınırlarından parçalar. */
function sentences(paragraph: string, targetChars: number): string[] {
  const parts: string[] = [];
  let buffer = "";
  for (const sentence of paragraph.split(SENTENCE_END)) {
    if (buffer && buffer.length + sentence.length > targetChars) {
      parts.push(buffer);
      buffer = "";
    }
    buffer = buffer ? `${buffer} ${sentence}` : sentence;
  }
  if (buffer) parts.push(buffer);
  return parts;
}

/** Başlıktaki Markdown vurgu işaretlerini temizler. */
function cleanInline(text: string): string {
  return text.replace(/[*_`]+/g, "").trim();
}
