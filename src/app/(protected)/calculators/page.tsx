"use client";

import React, { useState } from "react";
import {
  PEDIATRIC_CALCULATORS_CATALOG,
  PediatricCalculatorPlaceholderConfig,
} from "@/lib/pediatrics";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";

export default function PediatricCalculatorsPage() {
  const { session } = useClinicSession();
  const isAdmin = session?.role === "admin";
  const [adminEditMode, setAdminEditMode] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string>(PEDIATRIC_CALCULATORS_CATALOG[0].id);
  const [catalog, setCatalog] = useState<PediatricCalculatorPlaceholderConfig[]>(
    PEDIATRIC_CALCULATORS_CATALOG
  );

  const activeCalc = catalog.find((c) => c.id === selectedId) || catalog[0];

  return (
    <section aria-labelledby="calculators-page-heading">
      <div className="page-header">
        <div>
          <span className="sec-chip primary">Modül 2 • /calculators (Yer Tutucu Mimari)</span>
          <h1 id="calculators-page-heading" style={{ marginTop: "0.45rem" }}>
            Pediatri Hesaplama Uygulamaları
          </h1>
          <p className="page-header-subtitle">
            5 ana pediatrik hesaplama grubu için sayfa yapısı ve girdi/çıktı yer tutucuları hazırlandı. Detaylı formül motoru bir sonraki aşamada kodlanacaktır.
          </p>
        </div>

        {isAdmin && (
          <div className="mode-switcher" role="tablist" aria-label="Hesaplayıcı Yönetim Modu">
            <button
              id="calc-mode-user-btn"
              type="button"
              className={`mode-btn ${!adminEditMode ? "active" : ""}`}
              onClick={() => setAdminEditMode(false)}
            >
              Standart Görünüm
            </button>
            <button
              id="calc-mode-admin-btn"
              type="button"
              className={`mode-btn ${adminEditMode ? "active" : ""}`}
              onClick={() => setAdminEditMode(true)}
            >
              Protokol Düzenleme (Admin)
            </button>
          </div>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: "1.25rem" }}>
        <aside className="surface-card" aria-label="Hesaplayıcı Modül Listesi">
          <h2 style={{ marginBottom: "0.85rem" }}>Pediatrik Hesaplama Modülleri (5 Grup)</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {catalog.map((item) => (
              <button
                key={item.id}
                id={`select-calc-btn-${item.id}`}
                type="button"
                onClick={() => setSelectedId(item.id)}
                style={{
                  textAlign: "left",
                  padding: "0.85rem",
                  borderRadius: "var(--radius-md)",
                  border:
                    selectedId === item.id
                      ? "2px solid var(--clinical-primary)"
                      : "1px solid var(--border-subtle)",
                  background:
                    selectedId === item.id ? "var(--clinical-primary-soft)" : "var(--bg-surface)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="mono-num" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                    {item.code} • {item.categoryLabel}
                  </span>
                  <span className="sec-chip warn">Yer Tutucu (Placeholder)</span>
                </div>
                <div style={{ fontWeight: 700, marginTop: "0.3rem" }}>{item.title}</div>
              </button>
            ))}
          </div>
        </aside>

        <article className="surface-card" aria-labelledby="active-calc-heading">
          <span className="sec-chip primary">{activeCalc.code} • {activeCalc.formulaVersion}</span>
          <h2 id="active-calc-heading" style={{ marginTop: "0.5rem" }}>
            {activeCalc.title}
          </h2>
          <p className="page-header-subtitle" style={{ marginBottom: "1rem" }}>
            {activeCalc.summary}
          </p>

          {!isAdmin || !adminEditMode ? (
            <div>
              <div className="form-group">
                <span className="form-label">Planlanan Klinik Girdi Alanları (Placeholder):</span>
                <ul style={{ paddingLeft: "1.2rem", color: "var(--text-secondary)", fontSize: "0.86rem" }}>
                  {activeCalc.plannedInputs.map((inp, idx) => (
                    <li key={idx}>{inp}</li>
                  ))}
                </ul>
              </div>

              <div className="form-group">
                <span className="form-label">Planlanan Hesaplama Çıktıları (Placeholder):</span>
                <ul style={{ paddingLeft: "1.2rem", color: "var(--text-secondary)", fontSize: "0.86rem" }}>
                  {activeCalc.plannedOutputs.map((out, idx) => (
                    <li key={idx}>{out}</li>
                  ))}
                </ul>
              </div>

              <div
                style={{
                  padding: "0.9rem",
                  borderRadius: "var(--radius-md)",
                  background: "var(--status-warn-bg)",
                  color: "var(--status-warn)",
                  fontSize: "0.83rem",
                  fontWeight: 600,
                }}
              >
                Maksimum Doz Güvenlik Kilidi: {activeCalc.maxDoseGuardrailNote}
              </div>

              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.9rem",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.83rem",
                }}
              >
                <strong>Klinik Protokol Notu:</strong> {activeCalc.clinicalProtocolNote}
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const protocolNote = String(fd.get("clinicalProtocolNote") || "");
                const guardrail = String(fd.get("maxDoseGuardrailNote") || "");
                setCatalog((prev) =>
                  prev.map((c) =>
                    c.id === activeCalc.id
                      ? {
                          ...c,
                          clinicalProtocolNote: protocolNote,
                          maxDoseGuardrailNote: guardrail,
                        }
                      : c
                  )
                );
              }}
            >
              <div className="form-group">
                <label htmlFor="admin-guardrail-input" className="form-label">
                  Maksimum Doz Güvenlik Sınırı (Hard-Stop Notu)
                </label>
                <input
                  id="admin-guardrail-input"
                  name="maxDoseGuardrailNote"
                  className="form-input"
                  defaultValue={activeCalc.maxDoseGuardrailNote}
                />
              </div>

              <div className="form-group">
                <label htmlFor="admin-protocol-input" className="form-label">
                  Klinik Protokol Açıklaması
                </label>
                <textarea
                  id="admin-protocol-input"
                  name="clinicalProtocolNote"
                  className="form-textarea"
                  defaultValue={activeCalc.clinicalProtocolNote}
                />
              </div>

              <button id="save-calc-protocol-btn" type="submit" className="btn btn-primary">
                Protokol Notunu Güncelle
              </button>
            </form>
          )}
        </article>
      </div>
    </section>
  );
}
