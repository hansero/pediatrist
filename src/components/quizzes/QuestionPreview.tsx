"use client";

import type { QuestionType } from "@shared/constants";
import { StatusChip } from "@/components/ui/StatusChip";
import { useStorageUrl } from "@/lib/quiz/media";

const TYPE_LABEL: Record<QuestionType, string> = {
  "Single Choice": "Tek seçim",
  "Multiple Choice": "Çoklu seçim",
  "Text Input": "Açık uçlu",
};

export const questionTypeLabel = (t: QuestionType) => TYPE_LABEL[t];

/** Storage'daki soru görseli (gerçek `<img>`); bulunamazsa açık uyarı. */
export function QuizImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const url = useStorageUrl(path);
  if (!path) return null;
  if (url.status === "error") {
    return (
      <p className="ui-field-error" role="note">
        {url.error}
      </p>
    );
  }
  return (
    <figure className={className ?? "quiz-figure"}>
      {url.status === "ready" ? (
        // Storage indirme URL'si: next/image optimizasyonu emülatör/imzalı URL ile çalışmaz.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url.url} alt={alt} loading="lazy" />
      ) : (
        <div className="quiz-figure-placeholder" aria-hidden="true" />
      )}
    </figure>
  );
}

export interface PreviewQuestion {
  caseContent: string;
  imageUrl: string;
  questionText: string;
  questionType: QuestionType;
  maxLength: number;
  optionsArray: string[];
  correctAnswers?: string[];
  feedbackText?: string;
}

/**
 * Sorunun hekimin göreceği biçimde önizlemesi (admin). Cevap anahtarı ve öğrenme notu yalnızca `showKey`
 * açıkken gösterilir; doğru seçenek renge ek olarak metinle ("Doğru") işaretlenir.
 */
export function QuestionPreview({
  question,
  number,
  showKey,
}: {
  question: PreviewQuestion;
  number: number;
  showKey: boolean;
}) {
  const isText = question.questionType === "Text Input";
  const correct = new Set((question.correctAnswers ?? []).map((a) => a.trim().toLocaleLowerCase("tr")));
  const headingId = `preview-q-${number}`;
  return (
    <article className="question-preview" aria-labelledby={headingId}>
      <header className="question-preview-header">
        <h3 id={headingId}>Soru {number}</h3>
        <StatusChip>{TYPE_LABEL[question.questionType]}</StatusChip>
      </header>
      <p className="question-case">{question.caseContent}</p>
      {question.imageUrl && <QuizImage path={question.imageUrl} alt={`Soru ${number} görseli`} />}
      <p className="question-text">{question.questionText}</p>
      {isText ? (
        <p className="page-header-subtitle">Açık uçlu yanıt (en fazla {question.maxLength} karakter).</p>
      ) : (
        <ul className="question-options">
          {question.optionsArray.map((o) => {
            const isCorrect = showKey && correct.has(o.trim().toLocaleLowerCase("tr"));
            return (
              <li key={o} className={isCorrect ? "is-correct" : undefined}>
                {o}
                {isCorrect && (
                  <>
                    {" "}
                    <StatusChip tone="success">Doğru</StatusChip>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {showKey && (
        <div className="question-key">
          {isText && (
            <p>
              <strong>Kabul edilen yanıtlar:</strong> {(question.correctAnswers ?? []).join(" · ")}
            </p>
          )}
          {question.feedbackText && (
            <p>
              <strong>Öğrenme noktası:</strong> {question.feedbackText}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
