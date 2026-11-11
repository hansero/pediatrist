"use client";

import { useId, useState, type RefObject } from "react";
import type { CallableResponse } from "@shared/schemas";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useStorageUrl } from "@/lib/quiz/media";
import { questionTypeLabel } from "../QuestionPreview";

type AttemptQuestion = CallableResponse<"startQuizAttempt">["questions"][number];

/** Soru görseli: sayfada sığdırılmış; "Büyüt" tam boy diyalogda açar (klinik görüntü ayrıntısı için). */
export function ZoomableImage({ path, alt }: { path: string; alt: string }) {
  const url = useStorageUrl(path);
  const [open, setOpen] = useState(false);
  if (url.status === "error") {
    return (
      <p className="ui-field-error" role="note">
        {url.error}
      </p>
    );
  }
  return (
    <figure className="quiz-figure">
      {url.status === "ready" ? (
        // Storage indirme URL'si (next/image emülatör/imzalı URL ile çalışmaz).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url.url} alt={alt} />
      ) : (
        <div className="quiz-figure-placeholder" aria-hidden="true" />
      )}
      {url.status === "ready" && (
        <figcaption>
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Görseli büyüt
          </Button>
        </figcaption>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={alt}>
        <div className="zoom-body">
          {url.status === "ready" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url.url} alt={alt} />
          )}
        </div>
        <div className="ui-dialog-actions">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Kapat
          </Button>
        </div>
      </Dialog>
    </figure>
  );
}

/**
 * Tek soru (F5.3): `<fieldset><legend>` ile seçenek grubu; tek seçim radyo, çoklu seçim onay kutusu,
 * açık uçlu metin alanı (karakter sayacıyla). Doğru cevap bilgisi istemcide yoktur.
 */
export function ExamQuestion({
  question,
  number,
  total,
  value,
  onChange,
  disabled,
  headingRef,
}: {
  question: AttemptQuestion;
  number: number;
  total: number;
  value: string[];
  onChange: (value: string[]) => void;
  disabled: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const id = useId();
  const caseId = `${id}-case`;
  const type = question.questionType;

  return (
    <article className="exam-question" aria-labelledby={`${id}-heading`}>
      <header className="question-preview-header">
        <h3 id={`${id}-heading`} ref={headingRef} tabIndex={-1}>
          Soru {number} / {total}
        </h3>
        <span className="page-header-subtitle">{questionTypeLabel(type)}</span>
      </header>
      <p id={caseId} className="question-case">
        {question.caseContent}
      </p>
      {question.imagePath && <ZoomableImage path={question.imagePath} alt={`Soru ${number} görseli`} />}

      {type === "Text Input" ? (
        <div className="form-group">
          <label htmlFor={`${id}-text`} className="form-label question-text">
            {question.questionText}
          </label>
          <textarea
            id={`${id}-text`}
            className="form-textarea"
            rows={3}
            maxLength={question.maxLength}
            value={value[0] ?? ""}
            disabled={disabled}
            aria-describedby={`${caseId} ${id}-count`}
            onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
          />
          <p id={`${id}-count`} className="ui-field-hint mono-num">
            {(value[0] ?? "").length} / {question.maxLength} karakter
          </p>
        </div>
      ) : (
        <fieldset className="ui-fieldset exam-options" aria-describedby={caseId} disabled={disabled}>
          <legend className="question-text">
            {question.questionText}
            {type === "Multiple Choice" && <span className="page-header-subtitle"> (birden fazla seçilebilir)</span>}
          </legend>
          {question.options.map((option, i) => {
            const optionId = `${id}-o${i}`;
            const checked = value.includes(option);
            return (
              <label key={option} htmlFor={optionId} className={`exam-option${checked ? " selected" : ""}`}>
                <input
                  id={optionId}
                  type={type === "Single Choice" ? "radio" : "checkbox"}
                  name={`${id}-options`}
                  checked={checked}
                  onChange={(e) => {
                    if (type === "Single Choice") onChange([option]);
                    else onChange(e.target.checked ? [...value, option] : value.filter((v) => v !== option));
                  }}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </fieldset>
      )}
    </article>
  );
}
