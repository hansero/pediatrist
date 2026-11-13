"use client";

import { useState, type KeyboardEvent } from "react";
import { labelKey, MATERIAL_LABEL_LIMITS, normalizeLabel, type LabelOption } from "@shared/materials";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

/**
 * Materyal etiketleri (D25, F11.5): admin serbestçe yazar; daha önce kullanılmış etiketler öneri olarak gelir.
 * Önerideki bir etiketle aynı olan (Türkçe küçük harfe göre) yazım, önerinin yazımına çevrilir; böylece
 * "neonatoloji" ve "Neonatoloji" iki ayrı etiket olmaz. Sınırlar sunucuyla aynı (`LIMITS.materialLabels`).
 */
export function LabelInput({
  value,
  onChange,
  suggestions,
  idPrefix,
}: {
  value: string[];
  onChange: (labels: string[]) => void;
  suggestions: readonly LabelOption[];
  idPrefix: string;
}) {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const listId = `${idPrefix}-label-options`;
  const taken = new Set(value.map(labelKey));
  const full = value.length >= MATERIAL_LABEL_LIMITS.max;

  /** Bir ya da birden çok etiketi sırayla ekler (yapıştırılan "a, b" tek seferde). */
  function add(...raws: string[]) {
    const next = [...value];
    let message = "";
    for (const raw of raws) {
      const label = normalizeLabel(raw);
      if (!label) continue;
      const key = labelKey(label);
      if (label.length > MATERIAL_LABEL_LIMITS.length) {
        message = `Etiket en fazla ${MATERIAL_LABEL_LIMITS.length} karakter olabilir.`;
      } else if (next.some((l) => labelKey(l) === key)) {
        message = `"${label}" zaten ekli.`;
      } else if (next.length >= MATERIAL_LABEL_LIMITS.max) {
        message = `En fazla ${MATERIAL_LABEL_LIMITS.max} etiket eklenebilir.`;
      } else {
        next.push(suggestions.find((s) => s.key === key)?.label ?? label);
      }
    }
    if (next.length !== value.length) onChange(next);
    setNotice(message);
  }

  function commit(raw: string) {
    // Çok uzun etikette yazılan metin silinmez (kullanıcı kısaltabilsin); diğer durumlarda alan temizlenir.
    const tooLong = normalizeLabel(raw).length > MATERIAL_LABEL_LIMITS.length;
    add(raw);
    if (!tooLong) setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    }
  }

  return (
    <div className="label-input">
      <Field
        label="Etiketler"
        hint={`İsteğe bağlı. Yazıp Enter'a basın ya da önerilerden seçin; en fazla ${MATERIAL_LABEL_LIMITS.max} etiket.`}
      >
        {(p) => (
          <div className="label-input-row">
            <input
              {...p}
              className="form-input"
              list={listId}
              maxLength={MATERIAL_LABEL_LIMITS.length + 10}
              value={draft}
              disabled={full}
              onChange={(e) => {
                const next = e.target.value;
                // Virgülle ayrılmış birden çok etiket yapıştırılabilir.
                if (next.includes(",")) {
                  const parts = next.split(",");
                  add(...parts.slice(0, -1));
                  setDraft(parts[parts.length - 1]);
                } else {
                  setDraft(next);
                }
              }}
              onKeyDown={onKeyDown}
            />
            <Button variant="secondary" onClick={() => commit(draft)} disabled={full || !normalizeLabel(draft)}>
              Etiket ekle
            </Button>
          </div>
        )}
      </Field>
      <datalist id={listId}>
        {suggestions
          .filter((s) => !taken.has(s.key))
          .map((s) => (
            <option key={s.key} value={s.label} />
          ))}
      </datalist>
      {value.length > 0 && (
        <ul className="label-chips" aria-label="Eklenen etiketler">
          {value.map((label) => (
            <li key={labelKey(label)} className="label-chip">
              <span>{label}</span>
              <button
                type="button"
                className="ui-icon-btn"
                aria-label={`${label} etiketini kaldır`}
                onClick={() => onChange(value.filter((l) => l !== label))}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="ui-field-hint" aria-live="polite">
        {notice}
      </p>
    </div>
  );
}
