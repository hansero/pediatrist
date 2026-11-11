import { describe, expect, it } from "vitest";
import {
  buildReport,
  gradeAttempt,
  isAnswerCorrect,
  sanitizeResponse,
  type GradableQuestion,
} from "../src/quizGrading";
import type { QuizQuestionPublicDoc } from "../src/shared/types";

const q = (
  id: string,
  questionType: QuizQuestionPublicDoc["questionType"],
  correctAnswers: string[],
  extra: Partial<QuizQuestionPublicDoc> = {}
): GradableQuestion => ({
  id,
  data: {
    orderIndex: Number(id.slice(-1)),
    caseContent: "Vaka",
    imageUrl: "",
    questionText: "Soru",
    questionType,
    maxLength: questionType === "Text Input" ? 10 : 0,
    optionsRaw: "A | B | C",
    optionsArray: questionType === "Text Input" ? [] : ["A", "B", "C"],
    ...extra,
  },
  key: { correctAnswers, feedbackText: "Öğrenme noktası" },
});

describe("sınav puanlaması (yalnızca sunucu)", () => {
  it("tek seçim: tam bir yanıt gerekir; birden fazla seçim yanlış", () => {
    const single = q("q_1", "Single Choice", ["B"]);
    expect(isAnswerCorrect(single.data, single.key, ["b"])).toBe(true);
    expect(isAnswerCorrect(single.data, single.key, ["B", "C"])).toBe(false);
    expect(isAnswerCorrect(single.data, single.key, [])).toBe(false);
  });

  it("çoklu seçim: küme eşitliği (sıra/harf/boşluk/tekrar önemsiz), eksik veya fazla yanlış", () => {
    const multi = q("q_2", "Multiple Choice", ["A", "C"]);
    const norm = (r: string[]) => sanitizeResponse(multi.data, r);
    expect(isAnswerCorrect(multi.data, multi.key, norm([" c ", "a", "A"]))).toBe(true);
    expect(isAnswerCorrect(multi.data, multi.key, norm(["A"]))).toBe(false);
    expect(isAnswerCorrect(multi.data, multi.key, norm(["A", "B", "C"]))).toBe(false);
  });

  it("metin: Türkçe büyük/küçük harf duyarsız; maxLength'e kırpılır; boş yanıt yanlış", () => {
    const text = q("q_3", "Text Input", ["İnsülin"]);
    expect(sanitizeResponse(text.data, ["  ", "x"])).toEqual([]);
    expect(sanitizeResponse(text.data, ["123456789012345"])).toEqual(["1234567890"]);
    expect(isAnswerCorrect(text.data, text.key, sanitizeResponse(text.data, ["  insülin "]))).toBe(true);
    expect(isAnswerCorrect(text.data, text.key, [])).toBe(false);
  });

  it("gradeAttempt puanı yuvarlar; buildReport karne kapalıyken doğru cevap ve feedback döndürmez", () => {
    const qs = [q("q_1", "Single Choice", ["A"]), q("q_2", "Single Choice", ["B"]), q("q_3", "Text Input", ["x"])];
    const graded = gradeAttempt(qs, { q_1: ["A"], q_2: ["A"], bilinmeyen: ["A"] });
    expect(graded).toMatchObject({ correctCount: 1, totalQuestions: 3, score: 33 });
    expect(graded.results.map((r) => r.userResponse)).toEqual([["A"], ["A"], []]);
    const hidden = buildReport(qs, graded.results, false);
    expect(hidden.every((i) => i.correctAnswers === null && i.feedbackText === null)).toBe(true);
    expect(buildReport(qs, graded.results, true)[0]).toMatchObject({
      correctAnswers: ["A"],
      feedbackText: "Öğrenme noktası",
    });
  });
});
