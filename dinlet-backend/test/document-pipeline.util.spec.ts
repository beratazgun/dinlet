import { describe, expect, it } from "vitest";

import {
  buildRawScript,
  computeProgress,
  hashScript,
  resolveFinalStatus,
  splitMarkdownIntoSections,
} from "#/modules/document/utils/index.js";

const paragraph = (char: string, length: number) => char.repeat(length);

describe("splitMarkdownIntoSections", () => {
  it("# ve ## başlıklarından böler, ### içerikte kalır", () => {
    const md = [
      "# Kuruluş Dönemi",
      paragraph("a", 500),
      "### Alt başlık",
      paragraph("b", 100),
      "## **Yükselme** Dönemi",
      paragraph("c", 600),
    ].join("\n\n");

    const sections = splitMarkdownIntoSections(md);
    expect(sections.map((s) => s.title)).toEqual([
      "Kuruluş Dönemi",
      "Yükselme Dönemi",
    ]);
    expect(sections[0]!.text).toContain("### Alt başlık");
  });

  it("uzun bölümü paragraf sınırından parçalara ayırır", () => {
    const md = [
      "# Uzun",
      ...Array.from({ length: 6 }, () => paragraph("x", 1_500)),
    ].join("\n\n");

    const sections = splitMarkdownIntoSections(md, { targetChars: 4_000 });
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0]!.title).toBe(`Uzun (1/${sections.length})`);
    for (const section of sections) {
      expect(section.text.length).toBeLessThanOrEqual(4_000 + 1_500);
    }
  });

  it("tek dev paragrafı cümle sınırından böler", () => {
    const sentence = `${"kelime ".repeat(30).trim()}.`;
    const md = `# Tek\n\n${Array.from({ length: 60 }, () => sentence).join(" ")}`;
    const sections = splitMarkdownIntoSections(md, { targetChars: 2_000 });
    expect(sections.length).toBeGreaterThan(1);
    expect(sections.every((s) => s.text.endsWith("."))).toBe(true);
  });

  it("kısa bölümü bir öncekiyle birleştirir", () => {
    const md = [
      "# Birinci",
      paragraph("a", 800),
      "# Kısa",
      "Tek cümle.",
      "# Üçüncü",
      paragraph("c", 800),
    ].join("\n\n");

    const sections = splitMarkdownIntoSections(md);
    expect(sections.map((s) => s.title)).toEqual(["Birinci", "Üçüncü"]);
    expect(sections[0]!.text).toContain("### Kısa");
  });

  it("başlıksız metne sıra numaralı başlık verir", () => {
    const sections = splitMarkdownIntoSections(paragraph("z", 900));
    expect(sections).toEqual([{ title: "Bölüm 1", text: paragraph("z", 900) }]);
  });

  it("boş metinde bölüm üretmez", () => {
    expect(splitMarkdownIntoSections("  \n\n ")).toEqual([]);
  });
});

describe("buildRawScript", () => {
  it("madde işaretlerini kaldırır ve her maddeyi cümle yapar", () => {
    const script = buildRawScript(
      "• Kuruluş: 1299\n• Kurucu: **Osman Bey**\n- Başkent Söğüt",
    );
    expect(script).toEqual({
      paragraphs: ["Kuruluş: 1299. Kurucu: Osman Bey. Başkent Söğüt."],
      recap: null,
    });
  });

  it("tabloları satır satır okur, ayırıcı satırı atlar", () => {
    const script = buildRawScript(
      "| Padişah | Yıl |\n|---|---|\n| Orhan Bey | 1326 |",
    );
    expect(script.paragraphs).toEqual(["Padişah, Yıl. Orhan Bey, 1326."]);
  });

  it("başlık, bağlantı ve görselleri temizler; paragrafları korur", () => {
    const script = buildRawScript(
      "### Önemli\n\nBkz. [kaynak](http://x.y) ![şema](a.png)\n\nİkinci paragraf!",
    );
    expect(script.paragraphs).toEqual([
      "Önemli.",
      "Bkz. kaynak.",
      "İkinci paragraf!",
    ]);
  });

  it("aynı metin için aynı, farklı metin için farklı özet üretir", () => {
    const a = { paragraphs: ["Bir."], recap: null };
    expect(hashScript(a)).toBe(hashScript({ ...a }));
    expect(hashScript(a)).not.toBe(hashScript({ paragraphs: ["İki."], recap: null }));
    expect(hashScript(a)).toHaveLength(16);
  });
});

describe("computeProgress / resolveFinalStatus", () => {
  const sections = [
    { id: 1, charCount: 300, status: "READY" as const },
    { id: 2, charCount: 700, status: "SYNTHESIZING" as const },
  ];

  it("çıkarma %10 + bölümleme %5 + seslendirmenin %85'i", () => {
    expect(computeProgress("QUEUED", [])).toEqual({ percent: 0, readySectionIds: [] });
    expect(computeProgress("SCRIPTING", []).percent).toBe(10);
    expect(computeProgress("SYNTHESIZING", sections)).toEqual({
      percent: 15 + Math.floor(85 * 0.3),
      readySectionIds: [1],
    });
    expect(computeProgress("READY", sections).percent).toBe(100);
  });

  it("tüm bölümler sonuçlanınca son durumu belirler", () => {
    expect(resolveFinalStatus(sections)).toBeNull();
    expect(resolveFinalStatus([{ status: "READY" }, { status: "READY" }])).toBe("READY");
    expect(resolveFinalStatus([{ status: "READY" }, { status: "FAILED" }])).toBe("PARTIAL");
    expect(resolveFinalStatus([{ status: "FAILED" }])).toBe("FAILED");
  });
});
