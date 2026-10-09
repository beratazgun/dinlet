import { describe, expect, it } from "vitest";

import {
  extractFacts,
  isFactCovered,
  numberToTurkishWords,
} from "#/modules/document/utils/index.js";

describe("numberToTurkishWords", () => {
  it("yılları ve büyük sayıları okunduğu gibi yazar", () => {
    expect(numberToTurkishWords(1299)).toBe("bin iki yüz doksan dokuz");
    expect(numberToTurkishWords(1923)).toBe("bin dokuz yüz yirmi üç");
    expect(numberToTurkishWords(2000)).toBe("iki bin");
    expect(numberToTurkishWords(101)).toBe("yüz bir");
    expect(numberToTurkishWords(1_500_000)).toBe("bir milyon beş yüz bin");
    expect(numberToTurkishWords(45)).toBe("kırk beş");
  });
});

describe("kapsam", () => {
  const source = [
    "# Orhan Bey Dönemi",
    "• Bursa 1326'da fethedildi.",
    "İlk vezir: Alaeddin Paşa",
    "Ordu 25 bin kişiydi; vergi oranı %12,5 idi.",
    "Bu dönemde ilk Osmanlı parası (akçe) bastırıldı.",
  ].join("\n");

  it("başlığı atlar; tarih, sayı ve özel isimleri çıkarır", () => {
    const terms = extractFacts(source).map(
      (fact) => `${fact.kind}:${fact.term}`,
    );
    expect(terms).toEqual(
      expect.arrayContaining([
        "date:1326",
        "name:Alaeddin Paşa",
        "number:25",
        "number:12,5",
        "name:Osmanlı",
      ]),
    );
    // Cümle başındaki tek kelimeler ("Bursa", "Bu") isim sayılmaz; başlık atlanır.
    expect(terms).not.toContain("name:Bu");
    expect(terms.some((term) => term.includes("Orhan"))).toBe(false);
  });

  it("anlatımda rakamla veya okunuşla geçen bilgiyi kapsanmış sayar", () => {
    const script =
      "Bursa bin üç yüz yirmi altıda fethedildi. Osmanlı ordusu yirmi beş bin kişiydi; vergi yüzde on iki virgül beşti. İlk Osmanlı parası basıldı.";
    const facts = extractFacts(source);
    const covered = (term: string) =>
      isFactCovered(
        facts.find((fact) => fact.term === term)!,
        script,
      );
    expect(covered("1326")).toBe(true);
    expect(covered("25")).toBe(true);
    expect(covered("12,5")).toBe(true);
    expect(covered("Osmanlı")).toBe(true);
    expect(covered("Alaeddin Paşa")).toBe(false);
  });

  it("kod bloklarındaki (```) ve satır içi kodlardaki (`...`) sayı ve kelimeleri atlar", () => {
    const sourceWithCode = [
      "Model çıkarımı için aşağıdaki kod kullanılır:",
      "```python",
      "import cv2",
      "import layoutparser as lp # Belgeyi yükle",
      "model = lp.Detectron2LayoutModel('lp://PubLayNet/faster_rcnn_R_50_FPN_3x')",
      "```",
      "Bu yöntemle 2024 yılında `config.json` dosyası üzerinden test yapıldı.",
    ].join("\n");

    const facts = extractFacts(sourceWithCode);
    const terms = facts.map((f) => `${f.kind}:${f.term}`);

    expect(terms).toContain("date:2024");
    expect(terms).not.toContain("number:50");
    expect(terms).not.toContain("name:Belgeyi");
    expect(terms).not.toContain("name:Layout");
    expect(terms).not.toContain("name:Detectron");
    expect(terms).not.toContain("name:Config");
  });
});

