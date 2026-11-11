"use client";

import { LIMITS, REVEAL_POLICIES, type RevealPolicy } from "@shared/constants";
import { Field } from "@/components/ui/Field";

/** Sınav ayarları formu (yeni taslak, düzenleme, yayın): süre, kapanış zamanı, sonuç gösterimi (D7). */
export interface QuizSettingsValue {
  durationMinutes: string;
  /** `<input type="datetime-local">` değeri (yerel saat) ya da "" (kapanış zamanı yok). */
  closesAtLocal: string;
  revealPolicy: RevealPolicy;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ms → `datetime-local` değeri (yerel saat). */
export function toLocalInput(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` (zaman dilimi yok → yerel saat) → ms; boşsa `null`, geçersizse `NaN`. */
export function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return Number.NaN;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime();
}

export interface SettingsErrors {
  durationMinutes?: string;
  closesAt?: string;
}

/** İstemci denetimi (sunucu da aynısını yapar): süre aralığı, kapanış gelecekte. */
export function validateSettings(v: QuizSettingsValue, nowMs = Date.now()): SettingsErrors {
  const errors: SettingsErrors = {};
  const minutes = Number(v.durationMinutes);
  const { min, max } = LIMITS.quizMinutes;
  if (!Number.isInteger(minutes) || minutes < min || minutes > max) {
    errors.durationMinutes = `Süre ${min}–${max} dakika arasında tam sayı olmalı.`;
  }
  const closes = fromLocalInput(v.closesAtLocal);
  if (closes !== null && (Number.isNaN(closes) || closes <= nowMs)) {
    errors.closesAt = "Kapanış zamanı gelecekte bir an olmalı.";
  }
  return errors;
}

const POLICY_TEXT: Record<RevealPolicy, { label: string; hint: string }> = {
  after_close: {
    label: "Sınav kapanınca (önerilen)",
    hint: "Hekim teslimde puanını ve doğru/yanlışlarını görür. Doğru cevaplar ve öğrenme notları sınav kapanıp son katılımcının süresi dolunca açılır.",
  },
  immediate: {
    label: "Teslimde hemen",
    hint: "Tam karne (doğru cevaplar ve öğrenme notları) teslimde görünür. Sınav sürerken cevaplar paylaşılabilir.",
  },
};

export function QuizSettingsFields({
  value,
  onChange,
  errors = {},
  idPrefix,
}: {
  value: QuizSettingsValue;
  onChange: (value: QuizSettingsValue) => void;
  errors?: SettingsErrors;
  idPrefix: string;
}) {
  return (
    <>
      <div className="grid-2">
        <Field
          label="Süre (dakika)"
          hint={`${LIMITS.quizMinutes.min}–${LIMITS.quizMinutes.max} dakika. Her hekimin süresi sınava girdiği anda başlar.`}
          error={errors.durationMinutes}
          required
        >
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="numeric"
              className="form-input"
              min={LIMITS.quizMinutes.min}
              max={LIMITS.quizMinutes.max}
              value={value.durationMinutes}
              onChange={(e) => onChange({ ...value, durationMinutes: e.target.value })}
            />
          )}
        </Field>
        <Field
          label="Kapanış zamanı"
          hint="İsteğe bağlı. Bu andan sonra yeni giriş alınmaz; süreler kapanışı aşamaz."
          error={errors.closesAt}
        >
          {(p) => (
            <input
              {...p}
              type="datetime-local"
              className="form-input"
              value={value.closesAtLocal}
              onChange={(e) => onChange({ ...value, closesAtLocal: e.target.value })}
            />
          )}
        </Field>
      </div>
      <fieldset className="ui-fieldset">
        <legend className="form-label">Sonuç gösterimi</legend>
        {REVEAL_POLICIES.map((policy) => {
          const id = `${idPrefix}-reveal-${policy}`;
          return (
            <div key={policy} className="radio-row">
              <input
                id={id}
                type="radio"
                name={`${idPrefix}-reveal`}
                value={policy}
                checked={value.revealPolicy === policy}
                onChange={() => onChange({ ...value, revealPolicy: policy })}
                aria-describedby={`${id}-hint`}
              />
              <div>
                <label htmlFor={id}>{POLICY_TEXT[policy].label}</label>
                <p id={`${id}-hint`} className="ui-field-hint">
                  {POLICY_TEXT[policy].hint}
                </p>
              </div>
            </div>
          );
        })}
      </fieldset>
    </>
  );
}
