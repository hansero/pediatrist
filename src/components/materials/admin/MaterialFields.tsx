"use client";

import { LIMITS, RESIDENCY_YEARS, type ResidencyYear } from "@shared/constants";
import { AUDIENCE_REQUIRED_MESSAGE, hasAudience, type LabelOption } from "@shared/materials";
import { Field } from "@/components/ui/Field";
import { LabelInput } from "./LabelInput";

/** Materyal meta verisi (yükleme ve düzenleme formu ortak). Etiketler serbest (D25). */
export interface MaterialFieldsValue {
  title: string;
  description: string;
  labels: string[];
  targetYears: ResidencyYear[];
  /** "Uzman" hedef kitlesi (yalnızca Uzm. Dr., D26). */
  targetSpecialists: boolean;
  isMandatory: boolean;
  allowDownload: boolean;
}

export interface MaterialFieldErrors {
  title?: string;
  targetYears?: string;
}

export const emptyMaterialFields = (): MaterialFieldsValue => ({
  title: "",
  description: "",
  labels: [],
  targetYears: [...RESIDENCY_YEARS],
  targetSpecialists: false,
  isMandatory: false,
  allowDownload: false,
});

export function validateMaterialFields(v: MaterialFieldsValue): MaterialFieldErrors {
  const errors: MaterialFieldErrors = {};
  if (!v.title.trim()) errors.title = "Başlık zorunlu.";
  if (!hasAudience(v.targetYears, v.targetSpecialists)) errors.targetYears = AUDIENCE_REQUIRED_MESSAGE;
  return errors;
}

export function MaterialFields({
  value,
  onChange,
  errors = {},
  idPrefix,
  labelSuggestions,
}: {
  value: MaterialFieldsValue;
  onChange: (v: MaterialFieldsValue) => void;
  errors?: MaterialFieldErrors;
  idPrefix: string;
  /** Daha önce kullanılmış etiketler (`distinctLabels`). */
  labelSuggestions: readonly LabelOption[];
}) {
  const yearsErrorId = `${idPrefix}-years-error`;
  return (
    <>
      <Field label="Başlık" error={errors.title} required>
        {(p) => (
          <input
            {...p}
            className="form-input"
            maxLength={LIMITS.titleLength}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        )}
      </Field>
      <Field label="Açıklama" hint="İsteğe bağlı; hekim listesinde görünür.">
        {(p) => (
          <textarea
            {...p}
            className="form-textarea"
            rows={3}
            maxLength={LIMITS.descriptionLength}
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
          />
        )}
      </Field>
      <LabelInput
        idPrefix={idPrefix}
        value={value.labels}
        suggestions={labelSuggestions}
        onChange={(labels) => onChange({ ...value, labels })}
      />
      <fieldset
        className="ui-fieldset"
        aria-invalid={errors.targetYears ? true : undefined}
        aria-describedby={errors.targetYears ? yearsErrorId : undefined}
      >
        <legend className="form-label">Hedef kıdem</legend>
        <div className="checkbox-row">
          {RESIDENCY_YEARS.map((y) => (
            <label key={y} className="consent-row">
              <input
                type="checkbox"
                checked={value.targetYears.includes(y)}
                onChange={(e) =>
                  onChange({
                    ...value,
                    targetYears: e.target.checked
                      ? [...value.targetYears, y].sort((a, b) => a - b)
                      : value.targetYears.filter((t) => t !== y),
                  })
                }
              />
              {y}. yıl
            </label>
          ))}
          <label className="consent-row">
            <input
              type="checkbox"
              checked={value.targetSpecialists}
              onChange={(e) => onChange({ ...value, targetSpecialists: e.target.checked })}
            />
            Uzman
          </label>
        </div>
        {errors.targetYears && (
          <p id={yearsErrorId} className="ui-field-error">
            {errors.targetYears}
          </p>
        )}
      </fieldset>
      <div className="checkbox-row">
        <label className="consent-row">
          <input
            type="checkbox"
            checked={value.isMandatory}
            onChange={(e) => onChange({ ...value, isMandatory: e.target.checked })}
          />
          Zorunlu okuma
        </label>
        <label className="consent-row">
          <input
            type="checkbox"
            checked={value.allowDownload}
            onChange={(e) => onChange({ ...value, allowDownload: e.target.checked })}
          />
          Hekimler indirebilir
        </label>
      </div>
    </>
  );
}
