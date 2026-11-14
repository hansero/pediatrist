/**
 * Sınav önizleme düzenleyicisinin (F14, D29) form modeli. Saf fonksiyonlar: React'e ve Firebase'e bağlı değil.
 *
 * - Doğrulama burada YAPILMAZ: form `draftFromForm` ile şemanın girdi biçimine çevrilir ve sunucuyla aynı
 *   `validateQuizQuestion` (shared) çalıştırılır. Önizlemede geçen soru sunucuda reddedilemez.
 * - Doğru cevap seçenek METNİYLE değil seçenek KİMLİĞİYLE izlenir: doğru işaretli seçeneğin metni
 *   düzenlenince doğru cevap da onu izler.
 */
import { LIMITS, QUESTION_TYPES, type QuestionType } from "@shared/constants";
import {
  normalizeClinicalAnswer,
  parsePipeSeparatedOptions,
  type NormalizedQuizQuestion,
  type QuizQuestionDraft,
} from "@shared/quizQuestion";

export interface OptionItem {
  id: string;
  text: string;
  correct: boolean;
}

export interface AnswerItem {
  id: string;
  text: string;
}

export interface QuestionForm {
  caseContent: string;
  questionText: string;
  feedbackText: string;
  /** `quiz_media/...` Storage yolu veya boş. */
  imageUrl: string;
  /** CSV'den geçersiz bir tip gelebilir (ör. "Tek Seçim"); doğrulayıcı bunu bildirir. */
  questionType: string;
  /** Metin olarak tutulur: kullanıcı yazarken boş/eksik değer olabilir. */
  maxLength: string;
  /** Seçenekli tipler. */
  options: OptionItem[];
  /** Açık uçlu: kabul edilen yanıtlar. */
  acceptedAnswers: AnswerItem[];
  /**
   * Seçenekli soruda seçeneklerde bulunmayan doğru cevaplar (CSV hatası). Gönderilen taslağa eklenir ki
   * doğrulayıcı "Seçeneklerde bulunmuyor" desin; kullanıcı kaldırır ya da seçenek olarak ekler.
   */
  orphanAnswers: string[];
}

let seq = 0;
/** Oturum içinde benzersiz yerel kimlik (React anahtarı ve doğru cevap izlemesi için). */
export const localId = (prefix = "o") => `${prefix}${++seq}`;

export const isQuestionType = (t: string): t is QuestionType => (QUESTION_TYPES as readonly string[]).includes(t);

/** Açık uçluya geçerken boş uzunluk alanı için başlangıç değeri (sınırlar içinde). */
export const DEFAULT_TEXT_MAX_LENGTH = String(Math.min(200, LIMITS.textAnswerLength.max));

const asText = (v: unknown) => (typeof v === "string" ? v : "");
const asList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** CSV satır taslağından (veya normalize sorudan) form. */
export function formFromDraft(draft: QuizQuestionDraft | NormalizedQuizQuestion): QuestionForm {
  const type = asText(draft.questionType);
  const optionsArray = asList(draft.optionsArray);
  const optionTexts = optionsArray.length > 0 ? optionsArray : parsePipeSeparatedOptions(asText(draft.optionsRaw));
  const correct = asList(draft.correctAnswers);
  const isText = type === "Text Input";
  const optionKeys = new Set(optionTexts.map(normalizeClinicalAnswer));
  const correctKeys = new Set(correct.map(normalizeClinicalAnswer));
  const maxLength = draft.maxLength;
  return {
    caseContent: asText(draft.caseContent),
    questionText: asText(draft.questionText),
    feedbackText: asText(draft.feedbackText),
    imageUrl: asText(draft.imageUrl),
    questionType: type,
    maxLength: typeof maxLength === "number" && Number.isFinite(maxLength) && maxLength > 0 ? String(maxLength) : "",
    options: optionTexts.map((text) => ({
      id: localId(),
      text,
      correct: !isText && correctKeys.has(normalizeClinicalAnswer(text)),
    })),
    acceptedAnswers: isText ? correct.map((text) => ({ id: localId("a"), text })) : [],
    orphanAnswers: isText ? [] : correct.filter((a) => !optionKeys.has(normalizeClinicalAnswer(a))),
  };
}

/** Formu şemanın girdi biçimine çevirir (`validateQuizQuestion` ile doğrulanır). */
export function draftFromForm(form: QuestionForm): QuizQuestionDraft {
  const isText = form.questionType === "Text Input";
  const len = form.maxLength.trim();
  return {
    caseContent: form.caseContent,
    imageUrl: form.imageUrl,
    questionText: form.questionText,
    questionType: form.questionType as QuestionType,
    maxLength: isText ? (len === "" ? undefined : Number(len)) : undefined,
    optionsRaw: "",
    optionsArray: isText ? [] : form.options.map((o) => o.text),
    correctAnswers: isText
      ? form.acceptedAnswers.map((a) => a.text)
      : [...form.options.filter((o) => o.correct).map((o) => o.text), ...form.orphanAnswers],
    feedbackText: form.feedbackText,
  };
}

/** Değişiklik algılama için kararlı imza (yerel kimlikler hariç). */
export function formSignature(form: QuestionForm): string {
  return JSON.stringify(draftFromForm(form));
}

/**
 * Soru tipini değiştirir; iki alt durum (seçenekler / kabul edilen yanıtlar) korunur, böylece geri dönüldüğünde
 * kayıp olmaz. `trimmedCorrect`: tek seçime geçerken birden fazla doğru vardı ve yalnızca ilki korundu.
 */
export function changeQuestionType(
  form: QuestionForm,
  type: QuestionType
): { form: QuestionForm; trimmedCorrect: boolean } {
  let next: QuestionForm = { ...form, questionType: type };
  let trimmedCorrect = false;
  if (type === "Text Input") {
    if (next.maxLength.trim() === "") next.maxLength = DEFAULT_TEXT_MAX_LENGTH;
    if (next.acceptedAnswers.length === 0) {
      const fromOptions = form.options.filter((o) => o.correct).map((o) => o.text);
      next.acceptedAnswers = fromOptions.map((text) => ({ id: localId("a"), text }));
    }
  } else if (type === "Single Choice") {
    let seen = false;
    next = {
      ...next,
      options: next.options.map((o) => {
        if (!o.correct) return o;
        if (!seen) {
          seen = true;
          return o;
        }
        trimmedCorrect = true;
        return { ...o, correct: false };
      }),
    };
  }
  return { form: next, trimmedCorrect };
}

/** Doğru işaretini değiştirir: tek seçimde radyo davranışı (yalnızca biri doğru). */
export function toggleCorrect(form: QuestionForm, optionId: string): QuestionForm {
  const single = form.questionType === "Single Choice";
  return {
    ...form,
    options: form.options.map((o) =>
      o.id === optionId ? { ...o, correct: single ? true : !o.correct } : single ? { ...o, correct: false } : o
    ),
  };
}

export const setOptionText = (form: QuestionForm, id: string, text: string): QuestionForm => ({
  ...form,
  options: form.options.map((o) => (o.id === id ? { ...o, text } : o)),
});

export const addOption = (form: QuestionForm, text = ""): QuestionForm => ({
  ...form,
  options: [...form.options, { id: localId(), text, correct: false }],
});

export const removeOption = (form: QuestionForm, id: string): QuestionForm => ({
  ...form,
  options: form.options.filter((o) => o.id !== id),
});

export const setAnswerText = (form: QuestionForm, id: string, text: string): QuestionForm => ({
  ...form,
  acceptedAnswers: form.acceptedAnswers.map((a) => (a.id === id ? { ...a, text } : a)),
});

export const addAnswer = (form: QuestionForm): QuestionForm => ({
  ...form,
  acceptedAnswers: [...form.acceptedAnswers, { id: localId("a"), text: "" }],
});

export const removeAnswer = (form: QuestionForm, id: string): QuestionForm => ({
  ...form,
  acceptedAnswers: form.acceptedAnswers.filter((a) => a.id !== id),
});

/** Seçeneklerde olmayan doğru cevabı kaldırır. */
export const dropOrphan = (form: QuestionForm, text: string): QuestionForm => ({
  ...form,
  orphanAnswers: form.orphanAnswers.filter((a) => a !== text),
});

/** Seçeneklerde olmayan doğru cevabı doğru işaretli yeni seçenek yapar. */
export function orphanToOption(form: QuestionForm, text: string): QuestionForm {
  const base =
    form.questionType === "Single Choice" ? form.options.map((o) => ({ ...o, correct: false })) : form.options;
  return {
    ...form,
    options: [...base, { id: localId(), text, correct: true }],
    orphanAnswers: form.orphanAnswers.filter((a) => a !== text),
  };
}
