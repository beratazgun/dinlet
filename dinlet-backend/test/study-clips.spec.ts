import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseQuestions,
  parseScript,
} from "#/modules/document/services/narration.service.js";
import { hashScript, planStudyClips } from "#/modules/document/utils/index.js";

const QUESTION = {
  question: "Osmanlıların Bizans ile yaptığı ilk meydan savaşı hangisidir?",
  answer: "Maltepe (Palekanon) Savaşı",
  detail: "Bin üç yüz yirmi dokuzda, Orhan Bey döneminde yapıldı.",
};

describe("bölüm soruları", () => {
  it("eksik alanlı soruları atar ve en fazla üç soru alır", () => {
    expect(
      parseQuestions([
        QUESTION,
        { question: "Cevapsız?", answer: " " },
        "metin",
        { ...QUESTION, question: " İkinci? " },
        { ...QUESTION, question: "Üçüncü?" },
        { ...QUESTION, question: "Dördüncü?" },
      ]),
    ).toEqual([
      QUESTION,
      { ...QUESTION, question: "İkinci?" },
      { ...QUESTION, question: "Üçüncü?" },
    ]);
  });

  it("sorusu olmayan anlatımda alanı hiç eklemez", () => {
    expect(
      parseScript({ paragraphs: ["A."], recap: "Bu bölümde…", questions: [] }),
    ).toEqual({
      paragraphs: ["A."],
      recap: "Bu bölümde…",
    });
    expect(
      parseScript({
        paragraphs: ["A."],
        recap: "Bu bölümde…",
        questions: [QUESTION],
      }),
    ).toMatchObject({ questions: [QUESTION] });
  });
});

describe("tekrar klipleri", () => {
  const audioKey = "audio/2/1-x/7-abc.mp3";

  it("özet, soru ve cevap kliplerini bölüm sesinin anahtarından türetir", () => {
    const plan = planStudyClips(audioKey, {
      paragraphs: ["A."],
      recap: "Bu bölümde…",
      questions: [QUESTION],
    });
    expect(plan.recapKey).toBe("audio/2/1-x/7-abc-recap.mp3");
    expect(plan.questions).toEqual([
      {
        questionKey: "audio/2/1-x/7-abc-q1.mp3",
        answerKey: "audio/2/1-x/7-abc-a1.mp3",
      },
    ]);
    expect(plan.clips.map((clip) => clip.text)).toEqual([
      "Bu bölümde…",
      QUESTION.question,
      `${QUESTION.answer}. ${QUESTION.detail}`,
    ]);
  });

  it("sorusuz bölümde klip üretmez", () => {
    expect(
      planStudyClips(audioKey, { paragraphs: ["A."], recap: "Özet" }).clips,
    ).toEqual([]);
  });

  it("sorusuz metnin özeti önceki biçimle aynı kalır", () => {
    const script = { paragraphs: ["A.", "B."], recap: null };
    const legacy = createHash("sha256")
      .update(JSON.stringify([script.paragraphs, script.recap]))
      .digest("hex")
      .slice(0, 16);
    expect(hashScript(script)).toBe(legacy);
    expect(hashScript({ ...script, questions: [QUESTION] })).not.toBe(legacy);
  });
});
