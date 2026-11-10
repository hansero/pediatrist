"use client";

import { useId, type ReactNode } from "react";

export interface FieldControlProps {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
  required: boolean | undefined;
}

export interface FieldProps {
  label: ReactNode;
  /** Kalıcı yardım metni (biçim, sınır). */
  hint?: ReactNode;
  /** Alan hatası; varsa kontrol `aria-invalid` olur ve metin ona bağlanır. */
  error?: string;
  required?: boolean;
  /** Kontrolü çizer; verilen nitelikleri input/select/textarea'ya yayın. */
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Etiket + kontrol + yardım + hata (WCAG 1.3.1, 3.3.1, 3.3.2).
 *
 * ```tsx
 * <Field label="E-posta" error={errors.email} required>
 *   {(p) => <input {...p} className="form-input" type="email" autoComplete="username" />}
 * </Field>
 * ```
 */
export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">
        {label}
        {required && (
          <span className="ui-required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, required })}
      {hint && (
        <p id={hintId} className="ui-field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="ui-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
