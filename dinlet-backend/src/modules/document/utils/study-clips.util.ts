import type { TtsClip } from "#/modules/document/queue/document-queue.types.js";
import type { SectionScript } from "#/modules/document/types/index.js";

export interface StudyClipPlan {
  recapKey: string | null;
  questions: { questionKey: string; answerKey: string }[];
  clips: TtsClip[];
}

/**
 * Bölüm sesinin yanına aralıklı tekrar sesleri: tekrar özeti ve her soru
 * için soru + cevap. Yalnızca sorusu olan (Pro anlatımı) bölümlerde üretilir;
 * anahtarlar bölüm sesininkinden türetilir, aynı önekle birlikte silinir.
 */
export function planStudyClips(
  audioKey: string,
  script: SectionScript,
): StudyClipPlan {
  const questions = script.questions ?? [];
  if (questions.length === 0)
    return { recapKey: null, questions: [], clips: [] };

  const base = audioKey.replace(/\.mp3$/, "");
  const clips: TtsClip[] = [];
  let recapKey: string | null = null;
  if (script.recap) {
    recapKey = `${base}-recap.mp3`;
    clips.push({ audioKey: recapKey, text: script.recap });
  }

  const keys = questions.map((item, index) => {
    const questionKey = `${base}-q${index + 1}.mp3`;
    const answerKey = `${base}-a${index + 1}.mp3`;
    clips.push({ audioKey: questionKey, text: item.question });
    clips.push({
      audioKey: answerKey,
      text: item.detail ? `${item.answer}. ${item.detail}` : item.answer,
    });
    return { questionKey, answerKey };
  });

  return { recapKey, questions: keys, clips };
}
