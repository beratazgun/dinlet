/** Bölüm sonu sorusu (aralıklı tekrar ve sesli soru). */
export interface QuizItem {
  question: string;
  /** Kısa cevap ("Maltepe (Palekanon) Savaşı"). */
  answer: string;
  /** Cevabı bağlamıyla tek cümlede açıklar. */
  detail: string;
}

/**
 * Bir bölümün seslendirilecek metni. TTS worker paragraflar arasına kısa,
 * `recap` öncesine daha uzun sessizlik ekler.
 */
export interface SectionScript {
  paragraphs: string[];
  /** Bölüm sonu tekrar özeti; Free yolunda (LLM yok) `null`. */
  recap: string | null;
  /** Bölüm sonu soruları; yalnızca Pro anlatımında, yoksa alan da yok. */
  questions?: QuizItem[];
}
