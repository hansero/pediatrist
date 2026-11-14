"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LIMITS, QUESTION_TYPES, type QuestionType } from "@shared/constants";
import type { QuizQuestionIssue } from "@shared/quizQuestion";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import {
  addAnswer,
  addOption,
  changeQuestionType,
  draftFromForm,
  dropOrphan,
  orphanToOption,
  removeAnswer,
  removeOption,
  setAnswerText,
  setOptionText,
  toggleCorrect,
  type QuestionForm,
} from "@/lib/quiz/questionForm";
import { previewTypeLabel, questionTypeLabel, QuestionPreviewBody } from "../QuestionPreview";
import type { QuestionItem } from "./useCsvQuestions";

/** Kartın DOM kimlikleri: liste odak yönetimi (taşıma, silme, "Soruya git") bunları kullanır. */
export const cardIds = (key: string) => ({
  card: `qe-${key}`,
  heading: `qe-${key}-h`,
  edit: `qe-${key}-edit`,
  up: `qe-${key}-up`,
  down: `qe-${key}-down`,
});

const FIELD_GROUPS: Record<string, string[]> = {
  caseContent: ["caseContent"],
  questionText: ["questionText"],
  questionType: ["questionType"],
  maxLength: ["maxLength"],
  options: ["optionsArray", "optionsRaw"],
  correct: ["correctAnswers"],
  feedbackText: ["feedbackText"],
  imageUrl: ["imageUrl"],
};

/** Dış "Yeni sınav" formunda Enter taslağı kaydetmesin (tek satırlık alan, radyo, onay kutusu). */
const blockEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Enter") e.preventDefault();
};

const errorFor = (issues: readonly QuizQuestionIssue[], group: keyof typeof FIELD_GROUPS) =>
  issues
    .filter((i) => FIELD_GROUPS[group].includes(i.field))
    .map((i) => i.message)
    .join(" ") || undefined;

export interface QuestionEditorCardProps {
  item: QuestionItem;
  total: number;
  showKey: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onChange: (form: QuestionForm) => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}

/**
 * Önizlemede bir soru (F14, D29): hekimin göreceği biçim + araç çubuğu; "Düzenle" ile metinler ve cevap yapısı
 * değiştirilir. Her değişiklik sunucuyla aynı şemayla doğrulanır; hatalar alanın altında gösterilir.
 */
export function QuestionEditorCard(props: QuestionEditorCardProps) {
  const { item, total, showKey, editing } = props;
  const ids = cardIds(item.key);
  const n = item.number;
  const draft = draftFromForm(item.form);
  const generalIssues = item.issues.filter((i) => !Object.values(FIELD_GROUPS).flat().includes(i.field));

  return (
    <article
      id={ids.card}
      className="question-preview question-edit-card"
      aria-labelledby={ids.heading}
      data-invalid={item.issues.length > 0 || undefined}
    >
      <header className="question-preview-header">
        <h3 id={ids.heading} tabIndex={-1}>
          Soru {n}
        </h3>
        <span className="question-edit-chips">
          <StatusChip
            tone={
              item.form.questionType && !QUESTION_TYPES.includes(item.form.questionType as QuestionType)
                ? "critical"
                : undefined
            }
          >
            {previewTypeLabel(item.form.questionType)}
          </StatusChip>
          <StatusChip>CSV satır {item.sourceRow}</StatusChip>
          {item.edited && <StatusChip tone="info">Düzenlendi</StatusChip>}
          {item.issues.length > 0 && <StatusChip tone="critical">{item.issues.length} hata</StatusChip>}
        </span>
      </header>

      <div className="question-edit-toolbar" role="group" aria-label={`Soru ${n} işlemleri`}>
        <Button
          id={ids.edit}
          size="sm"
          variant={editing ? "primary" : "secondary"}
          aria-expanded={editing}
          aria-controls={`${ids.card}-form`}
          onClick={editing ? props.onDone : props.onEdit}
          aria-label={editing ? `Soru ${n}: bitti, düzenlemeyi kapat` : `Soru ${n}: düzenle`}
        >
          {editing ? "Bitti" : "Düzenle"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={props.onPickImage}
          aria-label={`Soru ${n}: ${item.form.imageUrl ? "görseli değiştir" : "görsel ekle"}`}
        >
          {item.form.imageUrl ? "Görseli değiştir" : "Görsel ekle"}
        </Button>
        {item.form.imageUrl && (
          <Button size="sm" variant="ghost" onClick={props.onRemoveImage} aria-label={`Soru ${n}: görseli kaldır`}>
            Görseli kaldır
          </Button>
        )}
        <Button
          id={ids.up}
          size="sm"
          variant="ghost"
          disabled={n === 1}
          onClick={() => props.onMove(-1)}
          aria-label={`Soru ${n}: yukarı taşı`}
        >
          Yukarı
        </Button>
        <Button
          id={ids.down}
          size="sm"
          variant="ghost"
          disabled={n === total}
          onClick={() => props.onMove(1)}
          aria-label={`Soru ${n}: aşağı taşı`}
        >
          Aşağı
        </Button>
        <Button size="sm" variant="ghost" onClick={props.onRemove} aria-label={`Soru ${n}: sınavdan çıkar`}>
          Çıkar
        </Button>
      </div>

      {item.issues.length > 0 && !editing && (
        <ul className="question-edit-issues" aria-label={`Soru ${n} hataları`}>
          {item.issues.map((i, idx) => (
            <li key={idx} className="ui-field-error">
              {i.label}: {i.message}
            </li>
          ))}
        </ul>
      )}
      {editing && generalIssues.length > 0 && (
        <Alert tone="critical">{generalIssues.map((i) => `${i.label}: ${i.message}`).join(" ")}</Alert>
      )}
      {item.form.imageUrl && errorFor(item.issues, "imageUrl") && (
        <p className="ui-field-error">{errorFor(item.issues, "imageUrl")}</p>
      )}

      {editing ? (
        <QuestionEditForm item={item} onChange={props.onChange} formId={`${ids.card}-form`} />
      ) : (
        <QuestionPreviewBody
          number={n}
          showKey={showKey}
          question={{
            caseContent: item.form.caseContent,
            imageUrl: item.form.imageUrl,
            questionText: item.form.questionText,
            questionType: item.form.questionType,
            maxLength: Number(item.form.maxLength) || 0,
            optionsArray: draft.optionsArray ?? [],
            correctAnswers: draft.correctAnswers,
            feedbackText: item.form.feedbackText,
          }}
        />
      )}
    </article>
  );
}

/**
 * Düzenleme alanları. `<form>` DEĞİL: dış "Yeni sınav" formunun içinde durur; tek satırlık alanda Enter'a basmak
 * taslağı kaydetmesin diye yakalanır.
 */
function QuestionEditForm({
  item,
  onChange,
  formId,
}: {
  item: QuestionItem;
  onChange: (form: QuestionForm) => void;
  formId: string;
}) {
  const uid = useId();
  const form = item.form;
  const n = item.number;
  const issues = item.issues;
  const isText = form.questionType === "Text Input";
  const single = form.questionType === "Single Choice";
  const [note, setNote] = useState("");
  const firstRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const typeError = errorFor(issues, "questionType");
  const optionsError = errorFor(issues, "options");
  const correctError = errorFor(issues, "correct");

  return (
    <div id={formId} className="question-edit-form">
      <Field label="Vaka (1. alan)" error={errorFor(issues, "caseContent")} required>
        {(p) => (
          <textarea
            {...p}
            ref={firstRef}
            rows={3}
            className="form-input"
            maxLength={LIMITS.caseContentLength}
            value={form.caseContent}
            onChange={(e) => onChange({ ...form, caseContent: e.target.value })}
          />
        )}
      </Field>
      <Field label="Soru (3. alan)" error={errorFor(issues, "questionText")} required>
        {(p) => (
          <textarea
            {...p}
            rows={2}
            className="form-input"
            maxLength={LIMITS.questionTextLength}
            value={form.questionText}
            onChange={(e) => onChange({ ...form, questionText: e.target.value })}
          />
        )}
      </Field>

      <fieldset className="ui-fieldset" aria-describedby={typeError ? `${uid}-type-err` : undefined}>
        <legend className="form-label">Soru tipi (4. alan)</legend>
        {QUESTION_TYPES.map((t) => (
          <div key={t} className="radio-row">
            <input
              onKeyDown={blockEnter}
              id={`${uid}-type-${t}`}
              type="radio"
              name={`${uid}-type`}
              checked={form.questionType === t}
              onChange={() => {
                const res = changeQuestionType(form, t);
                setNote(
                  res.trimmedCorrect ? "Tek seçimde yalnızca bir doğru olabilir: ilk doğru seçenek korundu." : ""
                );
                onChange(res.form);
              }}
            />
            <label htmlFor={`${uid}-type-${t}`}>{questionTypeLabel(t)}</label>
          </div>
        ))}
        {typeError && (
          <p id={`${uid}-type-err`} className="ui-field-error">
            {typeError}
          </p>
        )}
      </fieldset>
      <p role="status" className="page-header-subtitle">
        {note}
      </p>

      {isText ? (
        <>
          <Field
            label="En fazla karakter (5. alan)"
            hint={`${LIMITS.textAnswerLength.min}–${LIMITS.textAnswerLength.max} arası.`}
            error={errorFor(issues, "maxLength")}
            required
          >
            {(p) => (
              <input
                onKeyDown={blockEnter}
                {...p}
                type="number"
                inputMode="numeric"
                className="form-input"
                min={LIMITS.textAnswerLength.min}
                max={LIMITS.textAnswerLength.max}
                value={form.maxLength}
                onChange={(e) => onChange({ ...form, maxLength: e.target.value })}
              />
            )}
          </Field>
          <fieldset className="ui-fieldset" aria-describedby={correctError ? `${uid}-ans-err` : undefined}>
            <legend className="form-label">Kabul edilen yanıtlar (8. alan)</legend>
            <p className="ui-field-hint">Büyük/küçük harf farkı önemsenmez.</p>
            {form.acceptedAnswers.map((a, idx) => (
              <div key={a.id} className="option-edit-row option-edit-row--text">
                <input
                  onKeyDown={blockEnter}
                  type="text"
                  className="form-input"
                  aria-label={`Kabul edilen yanıt ${idx + 1}`}
                  maxLength={LIMITS.optionLength}
                  value={a.text}
                  onChange={(e) => onChange(setAnswerText(form, a.id, e.target.value))}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange(removeAnswer(form, a.id))}
                  aria-label={`Kabul edilen yanıt ${idx + 1}: kaldır`}
                >
                  Kaldır
                </Button>
              </div>
            ))}
            {correctError && (
              <p id={`${uid}-ans-err`} className="ui-field-error">
                {correctError}
              </p>
            )}
            <div>
              <Button size="sm" variant="secondary" onClick={() => onChange(addAnswer(form))}>
                Yanıt ekle
              </Button>
            </div>
          </fieldset>
        </>
      ) : (
        <fieldset
          className="ui-fieldset"
          aria-describedby={optionsError || correctError ? `${uid}-opt-err` : undefined}
        >
          <legend className="form-label">Seçenekler ve doğru cevap (6–8. alan)</legend>
          <p className="ui-field-hint">
            {single ? "Doğru seçeneği işaretleyin (tek doğru)." : "Doğru seçeneklerin hepsini işaretleyin."}
          </p>
          {form.options.map((o, idx) => (
            <div key={o.id} className="option-edit-row">
              <label className="option-edit-correct">
                <input
                  onKeyDown={blockEnter}
                  type={single ? "radio" : "checkbox"}
                  name={`${uid}-correct`}
                  checked={o.correct}
                  onChange={() => onChange(toggleCorrect(form, o.id))}
                />
                <span>
                  Doğru<span className="sr-only">: seçenek {idx + 1}</span>
                </span>
              </label>
              <input
                onKeyDown={blockEnter}
                type="text"
                className="form-input"
                aria-label={`Seçenek ${idx + 1}`}
                maxLength={LIMITS.optionLength}
                value={o.text}
                onChange={(e) => onChange(setOptionText(form, o.id, e.target.value))}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange(removeOption(form, o.id))}
                aria-label={`Seçenek ${idx + 1}: kaldır`}
              >
                Kaldır
              </Button>
            </div>
          ))}
          {form.orphanAnswers.map((a) => (
            <Alert key={a} tone="warning" title="Seçeneklerde olmayan doğru cevap">
              &quot;{a}&quot;{" "}
              <Button size="sm" variant="secondary" onClick={() => onChange(orphanToOption(form, a))}>
                Seçenek olarak ekle
              </Button>{" "}
              <Button size="sm" variant="ghost" onClick={() => onChange(dropOrphan(form, a))}>
                Kaldır
              </Button>
            </Alert>
          ))}
          {(optionsError || correctError) && (
            <p id={`${uid}-opt-err`} className="ui-field-error">
              {[optionsError, correctError].filter(Boolean).join(" ")}
            </p>
          )}
          <div>
            <Button size="sm" variant="secondary" onClick={() => onChange(addOption(form))}>
              Seçenek ekle
            </Button>
          </div>
        </fieldset>
      )}

      <Field label="Öğrenme notu (9. alan)" error={errorFor(issues, "feedbackText")} required>
        {(p) => (
          <textarea
            {...p}
            rows={3}
            className="form-input"
            maxLength={LIMITS.feedbackTextLength}
            value={form.feedbackText}
            onChange={(e) => onChange({ ...form, feedbackText: e.target.value })}
          />
        )}
      </Field>
      <p className="ui-field-hint">
        Soru {n}: değişiklikler &quot;Taslak olarak kaydet&quot;e kadar sunucuya gönderilmez.
      </p>
    </div>
  );
}
