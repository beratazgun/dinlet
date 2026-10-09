import { Injectable, Logger } from "@nestjs/common";

import { LlmService } from "#/infra/llm/index.js";
import { LlmUsageRepository } from "#/modules/document/repository/index.js";
import type {
  QuizItem,
  SectionScript,
} from "#/modules/document/types/index.js";
import {
  NARRATION_PROMPT_VERSION,
  QUIZ_QUESTIONS_PER_SECTION,
  NARRATION_SCHEMA,
  NARRATION_SYSTEM_PROMPT,
  buildNarrationUserContent,
} from "#/modules/document/utils/narration-prompt.js";
import { extractFacts } from "#/modules/document/utils/coverage.util.js";

/** `max_tokens`'ta kesilen bölüm en fazla bu derinliğe kadar ikiye bölünür. */
const MAX_SPLIT_DEPTH = 2;

export interface NarrationResult {
  script: SectionScript;
  model: string;
  promptVersion: string;
}

interface NarrationTarget {
  documentId: number;
  sectionId: number;
  title: string;
}

/**
 * Pro planda bölümün ham metnini LLM ile akıcı, dinlenebilir anlatıma
 * çevirir (doküman §5). Model reddederse, çıktı şemaya uymazsa veya kalıcı
 * hata olursa `null` döner; çağıran Free yoluna (kural tabanlı) düşer ve ses
 * yine üretilir.
 */
@Injectable()
export class NarrationService {
  private readonly logger = new Logger(NarrationService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly llmUsageRepository: LlmUsageRepository,
  ) {}

  get isAvailable(): boolean {
    return this.llmService.isEnabled;
  }

  async narrate(
    target: NarrationTarget,
    sourceText: string,
  ): Promise<NarrationResult | null> {
    try {
      const narrated = await this.narrateText(target, sourceText, 0);
      return narrated
        ? {
            script: narrated.script,
            model: narrated.model,
            promptVersion: NARRATION_PROMPT_VERSION,
          }
        : null;
    } catch (error) {
      this.logger.warn(
        `Bölüm#${target.sectionId} anlatımı üretilemedi, kural tabanlı yola düşülüyor: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async narrateText(
    target: NarrationTarget,
    text: string,
    depth: number,
  ): Promise<{ script: SectionScript; model: string } | null> {
    const result = await this.llmService.generateStructured({
      system: NARRATION_SYSTEM_PROMPT,
      // Nottaki tarih, sayı ve isimler: anlatımda atlanmasın (kapsam güvencesi).
      content: buildNarrationUserContent(
        target.title,
        text,
        extractFacts(text).map((fact) => fact.term),
      ),
      schema: NARRATION_SCHEMA,
    });
    for (const usage of result.usages) {
      await this.llmUsageRepository.record(usage, target);
    }

    if (result.kind === "refusal") return null;

    if (result.kind === "max_tokens") {
      const halves = splitInHalf(text);
      if (depth >= MAX_SPLIT_DEPTH || !halves) return null;
      const [first, second] = await Promise.all(
        halves.map((half) => this.narrateText(target, half, depth + 1)),
      );
      if (!first || !second) return null;
      const questions = [
        ...(first.script.questions ?? []),
        ...(second.script.questions ?? []),
      ].slice(0, QUIZ_QUESTIONS_PER_SECTION);
      return {
        script: {
          paragraphs: [...first.script.paragraphs, ...second.script.paragraphs],
          recap: second.script.recap ?? first.script.recap,
          ...(questions.length > 0 ? { questions } : {}),
        },
        model: first.model === second.model ? first.model : `${first.model}+${second.model}`,
      };
    }

    const script = parseScript(result.data);
    return script ? { script, model: result.model } : null;
  }
}

/** Şemaya uyan, boş olmayan çıktıyı `SectionScript`'e çevirir. */
export function parseScript(data: unknown): SectionScript | null {
  if (typeof data !== "object" || data === null) return null;
  const { paragraphs, recap, questions } = data as Record<string, unknown>;
  if (!Array.isArray(paragraphs)) return null;

  const cleaned = paragraphs
    .filter((paragraph): paragraph is string => typeof paragraph === "string")
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (cleaned.length === 0) return null;

  const quiz = parseQuestions(questions);
  return {
    paragraphs: cleaned,
    recap: typeof recap === "string" && recap.trim() ? recap.trim() : null,
    ...(quiz.length > 0 ? { questions: quiz } : {}),
  };
}

/** Eksik alanlı soruları atar; en fazla `QUIZ_QUESTIONS_PER_SECTION` tane. */
export function parseQuestions(data: unknown): QuizItem[] {
  if (!Array.isArray(data)) return [];
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  return data
    .map((item) => {
      const record = (typeof item === "object" && item !== null ? item : {}) as Record<
        string,
        unknown
      >;
      return {
        question: text(record.question),
        answer: text(record.answer),
        detail: text(record.detail),
      };
    })
    .filter((item) => item.question && item.answer)
    .slice(0, QUIZ_QUESTIONS_PER_SECTION);
}

/** Metni ortaya en yakın paragraf sınırından ikiye böler. */
export function splitInHalf(text: string): [string, string] | null {
  const blocks = text.split(/\n\s*\n/).filter((block) => block.trim());
  if (blocks.length < 2) return null;

  const middle = text.length / 2;
  let size = 0;
  let index = 0;
  while (index < blocks.length - 1 && size + blocks[index]!.length < middle) {
    size += blocks[index]!.length;
    index++;
  }
  const cut = Math.max(1, index);
  return [blocks.slice(0, cut).join("\n\n"), blocks.slice(cut).join("\n\n")];
}
