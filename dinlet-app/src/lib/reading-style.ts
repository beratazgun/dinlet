import type { TextStyle } from "react-native";
import type { TextSize, UserSettings } from "@/lib/settings-storage";

const TEXT_SIZES: Record<TextSize, { fontSize: number; lineHeight: number }> = {
  m: { fontSize: 17, lineHeight: 26 },
  l: { fontSize: 19, lineHeight: 30 },
  xl: { fontSize: 23, lineHeight: 36 },
};

export interface ReadingStyle {
  text: TextStyle;
  strong: TextStyle;
  colors: {
    background: string;
    ink: string;
    muted: string;
    /** Okunan paragrafın zemini. */
    current: string;
    border: string;
    /** Okunan kelimenin vurgusu. */
    wordBg: string;
    wordInk: string;
  };
}

/**
 * Metin görünümünün okuma stili: yazı boyutu, okuması kolay yazı tipi ve
 * yüksek kontrast ayarlarından türetilir.
 */
export function readingStyle(
  settings: Pick<UserSettings, "textSize" | "dyslexiaFont" | "highContrast">
): ReadingStyle {
  const size = TEXT_SIZES[settings.textSize] ?? TEXT_SIZES.m;
  const family = settings.dyslexiaFont
    ? { regular: "AtkinsonHyperlegible_400Regular", bold: "AtkinsonHyperlegible_700Bold" }
    : { regular: "Figtree_400Regular", bold: "Figtree_600SemiBold" };
  const letterSpacing = settings.dyslexiaFont ? size.fontSize * 0.02 : 0;

  const colors = settings.highContrast
    ? {
        background: "#000000",
        ink: "#FFFFFF",
        muted: "#C9CCDA",
        current: "#1A1A1A",
        border: "#FFFFFF",
        wordBg: "#FFE066",
        wordInk: "#000000",
      }
    : {
        background: "#FCFCFD",
        ink: "#0E1238",
        muted: "#6B7090",
        current: "#EEF0FB",
        border: "rgba(25,40,180,0.2)",
        wordBg: "#1928B4",
        wordInk: "#FFFFFF",
      };

  return {
    text: { ...size, fontFamily: family.regular, letterSpacing, color: colors.ink },
    strong: { fontFamily: family.bold },
    colors,
  };
}

/** Paragrafı kelimelere böler; boşluklar kelimeye yapışık kalır ki metin aynen çizilsin. */
export function splitWords(paragraph: string): string[] {
  return paragraph.match(/\S+\s*/g) ?? [];
}

/**
 * Paragrafın `ratio` (0–1) kadarı okunduysa o an okunan kelime. Sesin
 * kelime zamanlaması yok; uzun kelime daha uzun okunur varsayımıyla tahmin.
 */
export function activeWordIndex(words: string[], ratio: number): number {
  if (words.length === 0) return -1;
  const weights = words.map((word) => word.trim().length + 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const target = Math.max(0, Math.min(1, ratio)) * total;
  let cumulative = 0;
  for (let index = 0; index < weights.length; index++) {
    cumulative += weights[index]!;
    if (target < cumulative) return index;
  }
  return words.length - 1;
}
