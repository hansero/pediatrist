"use client";

import {
  LIMITS,
  MATERIAL_CATEGORIES,
  RESIDENCY_YEARS,
  type MaterialCategory,
  type ResidencyYear,
} from "@shared/constants";
import { Field } from "@/components/ui/Field";

/** Materyal meta verisi (yükleme ve düzenleme formu ortak; değerler ortak listelerden). */
export interface MaterialFieldsValue {
  title: string;
  description: string;
  category: MaterialCategory;
  targetYears: ResidencyYear[];
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
  category: MATERIAL_CATEGORIES[0],
  targetYears: [...RESIDENCY_YEARS],
  isMandatory: false,
  allowDownload: false,
});

export function validateMaterialFields(v: MaterialFieldsValue): MaterialFieldErrors {
  const errors: MaterialFieldErrors = {};
  if (!v.title.trim()) errors.title = "Başlık zorunlu.";
  if (v.targetYears.length === 0) errors.targetYears = "En az bir hedef kıdem seçin.";
  return errors;
}

export function MaterialFields({
  value,
  onChange,
  errors = {},
  idPrefix,
}: {
  value: MaterialFieldsValue;
  onChange: (v: MaterialFieldsValue) => void;
  errors?: MaterialFieldErrors;
  idPrefix: string;
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
      <Field label="Kategori" required>
        {(p) => (
          <select
            {...p}
            className="form-select"
            value={value.category}
            onChange={(e) => onChange({ ...value, category: e.target.value as MaterialCategory })}
          >
            {MATERIAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </Field>
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
                      ? [...value.targetYears, y].sort()
                      : value.targetYears.filter((t) => t !== y),
                  })
                }
              />
              {y}. yıl
            </label>
          ))}
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
