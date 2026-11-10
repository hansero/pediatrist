/**
 * 9 alanlı klinik soru: TEK doğrulama kaynağı (F1.2).
 *
 * Aynı zod şeması hem
 *  - sunucuda `saveQuizDraft` isteğini (bkz. `schemas.ts` → `SaveQuizDraftRequest`),
 *  - istemcide admin CSV önizlemesini (bkz. `quizCsv.ts` → `parseNineFieldQuizCsv`)
 * doğrular. Böylece admin önizlemesinde geçen bir soru sunucuda reddedilemez (ve tersi).
 *
 * Çıktı normalize edilmiştir: seçenekler tek listede (`optionsArray`), `optionsRaw` ondan üretilir,
 * seçenekli sorularda `maxLength` 0'dır.
 */
import { z } from "zod";
import { LIMITS, QUESTION_TYPES, type QuestionType } from "./constants";

/** `quiz_media/` altındaki bir Storage yolu. Harici URL'ler CSP'ye takılır ve kabul edilmez. */
export const QUIZ_IMAGE_PATH_RE = /^quiz_media\/[\w\-./]+$/;

/** Türkçe büyük/küçük harf duyarsız yanıt karşılaştırması için normalizasyon. */
export function normalizeClinicalAnswer(value: string): string {
  return (value || "").trim().toLocaleLowerCase("tr-TR");
}

/** 6. alandaki "|" ile ayrılmış seçenek metnini listeye çevirir. */
export function parsePipeSeparatedOptions(optionsRaw: string | undefined): string[] {
  if (!optionsRaw || !optionsRaw.trim()) return [];
  return optionsRaw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Alan → CSV sütun etiketi (önizleme hata listesinde gösterilir). */
export const QUESTION_FIELD_LABELS: Record<string, string> = {
  caseContent: "1: Soru İçeriği",
  imageUrl: "2: Soru Görseli",
  questionText: "3: Sorunun Kendi",
  questionType: "4: Soru Tipi",
  maxLength: "5: Maximum Length",
  optionsRaw: "6/7: Seçenekler",
  optionsArray: "6/7: Seçenekler",
  correctAnswers: "8: Doğru Seçenek",
  feedbackText: "9: Feedback_Text",
};

const required = (label: string, max: number) =>
  z
    .string({ error: `${label} zorunludur.` })
    .trim()
    .min(1, { error: `${label} zorunludur.` })
    .max(max, { error: `${label} en fazla ${max} karakter olabilir.` });

const answerText = z
  .string({ error: "Seçenek metin olmalıdır." })
  .trim()
  .min(1, { error: "Boş seçenek olamaz." })
  .max(LIMITS.optionLength, { error: `Seçenek en fazla ${LIMITS.optionLength} karakter olabilir.` });

const structural = z.object({
  caseContent: required("1. alan (Soru İçeriği)", LIMITS.caseContentLength),
  imageUrl: z
    .string({ error: "2. alan (Soru Görseli) metin olmalıdır." })
    .trim()
    .max(LIMITS.imagePathLength, { error: "Soru görseli yolu çok uzun." })
    .refine((v) => v === "" || QUIZ_IMAGE_PATH_RE.test(v), {
      error: "Soru görseli 'quiz_media/' ile başlayan bir Storage yolu olmalıdır.",
    })
    .optional(),
  questionText: required("3. alan (Sorunun Kendi)", LIMITS.questionTextLength),
  questionType: z.enum(QUESTION_TYPES, {
    error: "4. alan (Soru Tipi) 'Single Choice', 'Multiple Choice' veya 'Text Input' olmalıdır.",
  }),
  maxLength: z.number({ error: "5. alan (Maximum Length) sayı olmalıdır." }).optional(),
  optionsRaw: z
    .string()
    .max(LIMITS.optionLength * 20)
    .optional(),
  optionsArray: z.array(answerText).max(20, { error: "En fazla 20 seçenek olabilir." }).optional(),
  correctAnswers: z
    .array(answerText, { error: "8. alan (Doğru Seçenek) liste olmalıdır." })
    .min(1, { error: "8. alan (Doğru Seçenek) boş olamaz." })
    .max(20, { error: "En fazla 20 doğru yanıt olabilir." }),
  feedbackText: required("9. alan (Feedback_Text)", LIMITS.feedbackTextLength),
});

type StructuralQuestion = z.output<typeof structural>;

function optionsOf(q: Pick<StructuralQuestion, "optionsArray" | "optionsRaw">): string[] {
  return q.optionsArray && q.optionsArray.length > 0 ? q.optionsArray : parsePipeSeparatedOptions(q.optionsRaw);
}

/** Normalize edilmiş, depolamaya hazır soru (id / orderIndex sunucuda atanır). */
export interface NormalizedQuizQuestion {
  caseContent: string;
  imageUrl: string;
  questionText: string;
  questionType: QuestionType;
  maxLength: number;
  optionsRaw: string;
  optionsArray: string[];
  correctAnswers: string[];
  feedbackText: string;
}

/**
 * 9 alanlı soru şeması: yapısal kurallar + alanlar arası kurallar + normalizasyon.
 * Hata yolları (`path`) alan adlarıdır; `QUESTION_FIELD_LABELS` ile CSV sütununa çevrilir.
 */
export const QuizQuestionInput = structural
  .superRefine((q, ctx) => {
    const issue = (path: keyof StructuralQuestion, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    const max = LIMITS.textAnswerLength;

    if (q.questionType === "Text Input") {
      const len = q.maxLength;
      if (len === undefined || !Number.isInteger(len) || len < max.min || len > max.max) {
        issue("maxLength", `Text Input için ${max.min}–${max.max} arası tam sayı olmalıdır.`);
      } else if (q.correctAnswers.some((a) => a.length > len)) {
        issue("correctAnswers", "Kabul edilen yanıt Maximum Length'ten uzun.");
      }
      return;
    }

    const options = optionsOf(q);
    if (options.length < 2) issue("optionsArray", "Seçenekli sorularda en az 2 seçenek gerekir.");
    const set = new Set(options.map(normalizeClinicalAnswer));
    if (set.size !== options.length) issue("optionsArray", "Tekrarlanan seçenek var.");
    const missing = q.correctAnswers.filter((a) => !set.has(normalizeClinicalAnswer(a)));
    if (missing.length) issue("correctAnswers", `Seçeneklerde bulunmuyor: ${missing.join(", ")}`);
    if (new Set(q.correctAnswers.map(normalizeClinicalAnswer)).size !== q.correctAnswers.length) {
      issue("correctAnswers", "Tekrarlanan doğru yanıt var.");
    }
    if (q.questionType === "Single Choice" && q.correctAnswers.length !== 1) {
      issue("correctAnswers", "Single Choice tam 1 doğru yanıt içermeli.");
    }
  })
  .transform((q): NormalizedQuizQuestion => {
    const isText = q.questionType === "Text Input";
    const options = isText ? [] : optionsOf(q);
    return {
      caseContent: q.caseContent,
      imageUrl: q.imageUrl ?? "",
      questionText: q.questionText,
      questionType: q.questionType,
      maxLength: isText ? (q.maxLength ?? 0) : 0,
      optionsRaw: options.join(" | "),
      optionsArray: options,
      correctAnswers: q.correctAnswers,
      feedbackText: q.feedbackText,
    };
  });

/** İstemcinin gönderebileceği (normalizasyon öncesi) soru biçimi. */
export type QuizQuestionDraft = z.input<typeof QuizQuestionInput>;
