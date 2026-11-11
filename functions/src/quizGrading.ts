import { normalizeClinicalAnswer as norm } from "./shared/quizQuestion";
import type { AttemptResult, GradedItem, QuizAnswerKeyDoc, QuizQuestionPublicDoc } from "./shared/types";

/**
 * Sınav puanlaması — YALNIZCA SUNUCU (CLAUDE.md kural 5). Cevap anahtarıyla çalıştığı için `shared/` altında
 * değil: istemci paketine girmez. Saf fonksiyonlar; `quizService.ts` ve testler kullanır.
 */

export interface GradableQuestion {
  id: string;
  data: QuizQuestionPublicDoc;
  key: QuizAnswerKeyDoc;
}

/**
 * Hekimin yanıtını soru tipine göre temizler: metin sorusunda ilk yanıt `maxLength`'e kırpılır; seçenekli
 * sorularda boşlar ve tekrarlar atılır. (Seçenek dışı değer puanlamada zaten yanlış sayılır.)
 */
export function sanitizeResponse(q: QuizQuestionPublicDoc, raw: readonly string[] | undefined): string[] {
  const values = (raw ?? []).filter((v): v is string => typeof v === "string");
  if (q.questionType === "Text Input") {
    const first = (values[0] ?? "").trim().slice(0, q.maxLength || 500);
    return first ? [first] : [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(norm(t))) continue;
    seen.add(norm(t));
    out.push(t);
  }
  return out.slice(0, 20);
}

/** Metin: normalize edilmiş eşleşme (Türkçe büyük/küçük harf duyarsız). Seçenekli: küme eşitliği. */
export function isAnswerCorrect(q: QuizQuestionPublicDoc, key: QuizAnswerKeyDoc, response: readonly string[]): boolean {
  if (q.questionType === "Text Input") {
    const typed = norm(response[0] ?? "");
    return typed.length > 0 && key.correctAnswers.some((a) => norm(a) === typed);
  }
  if (q.questionType === "Single Choice" && response.length !== 1) return false;
  const u = [...new Set(response.map(norm))].sort();
  const c = [...new Set(key.correctAnswers.map(norm))].sort();
  return u.length === c.length && u.every((v, i) => v === c[i]);
}

export interface GradeResult {
  results: AttemptResult[];
  correctCount: number;
  totalQuestions: number;
  /** 0–100 tam sayı. */
  score: number;
}

export function gradeAttempt(
  questions: readonly GradableQuestion[],
  responses: Readonly<Record<string, readonly string[]>>
): GradeResult {
  const results = questions.map((q): AttemptResult => {
    const userResponse = sanitizeResponse(q.data, responses[q.id]);
    return {
      questionId: q.id,
      orderIndex: q.data.orderIndex,
      isCorrect: isAnswerCorrect(q.data, q.key, userResponse),
      userResponse,
    };
  });
  const correctCount = results.filter((r) => r.isCorrect).length;
  const totalQuestions = questions.length;
  return {
    results,
    correctCount,
    totalQuestions,
    score: totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0,
  };
}

/** Karne satırları. `revealed` değilse doğru cevap ve feedback `null` (D7). */
export function buildReport(
  questions: readonly GradableQuestion[],
  results: readonly AttemptResult[],
  revealed: boolean
): GradedItem[] {
  const byId = new Map(results.map((r) => [r.questionId, r]));
  return questions.map((q) => {
    const r = byId.get(q.id);
    return {
      questionId: q.id,
      orderIndex: q.data.orderIndex,
      caseContent: q.data.caseContent,
      imageUrl: q.data.imageUrl ?? "",
      questionText: q.data.questionText,
      questionType: q.data.questionType,
      options: q.data.optionsArray ?? [],
      isCorrect: r?.isCorrect ?? false,
      userResponse: r?.userResponse ?? [],
      correctAnswers: revealed ? q.key.correctAnswers : null,
      feedbackText: revealed ? q.key.feedbackText : null,
    };
  });
}
