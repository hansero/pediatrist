"use client";

import { useId, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { downloadTextFile } from "@/lib/csv";
import { buildNineFieldCsvTemplate, type CsvRowError } from "@/lib/quiz-parser";
import { QuestionPreview } from "../QuestionPreview";
import type { useCsvQuestions } from "./useCsvQuestions";

const PREVIEW_STEP = 20;

/**
 * CSV dosya seçimi + satır numaralı hatalar + eksik görseller + önizleme. "Cevap anahtarını göster"
 * varsayılan KAPALI (projeksiyonda/omuz üstünden yanlışlıkla görünmesin).
 */
export function CsvQuestionsPanel({
  csv,
  label = "Soru dosyası (CSV)",
}: {
  csv: ReturnType<typeof useCsvQuestions>;
  label?: string;
}) {
  const inputId = useId();
  const [showKey, setShowKey] = useState(false);
  const [visible, setVisible] = useState(PREVIEW_STEP);

  return (
    <div className="auth-stack">
      <div className="form-group">
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="form-input"
          aria-describedby={`${inputId}-hint`}
          onChange={(e) => {
            setVisible(PREVIEW_STEP);
            void csv.load(e.target.files?.[0] ?? null);
          }}
        />
        <p id={`${inputId}-hint`} className="ui-field-hint">
          9 sütunlu şablon; `;` veya `,` ayırıcı, UTF-8. Görseller önce &quot;Görseller&quot; sekmesinden yüklenir.{" "}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              downloadTextFile("pediatrist-sinav-sablonu.csv", buildNineFieldCsvTemplate(), "text/csv;charset=utf-8")
            }
          >
            Şablonu indir
          </Button>
        </p>
      </div>

      {csv.errors.length > 0 && (
        <>
          <Alert tone="critical" title={`${csv.errors.length} hata: dosya kaydedilemez`}>
            Hataları düzeltip dosyayı yeniden seçin. Sunucu aynı kuralları uygular.
          </Alert>
          <DataTable<CsvRowError>
            caption="CSV hataları"
            captionHidden
            columns={[
              { key: "row", header: "Satır", cell: (e) => (e.row ? e.row : "—") },
              { key: "field", header: "Alan", cell: (e) => e.field },
              { key: "message", header: "Hata", rowHeader: true, cell: (e) => e.message },
            ]}
            rows={csv.errors}
            rowKey={(e) => `${e.row}-${e.field}-${e.message}`}
          />
        </>
      )}

      {csv.mediaCheck === "checking" && <p className="page-header-subtitle">Görseller denetleniyor…</p>}
      {csv.mediaCheck === "error" && <Alert tone="critical">Görseller denetlenemedi: {csv.mediaError}</Alert>}
      {csv.missingMedia.length > 0 && (
        <Alert tone="critical" title="Storage'da bulunmayan görseller">
          {csv.missingMedia.map((m) => `Satır ${m.row}: ${m.path}`).join(" · ")}. Önce &quot;Görseller&quot; sekmesinden
          yükleyin veya yolu düzeltin.
        </Alert>
      )}

      {csv.questions.length > 0 && csv.errors.length === 0 && (
        <section aria-label="Soru önizlemesi" className="auth-stack">
          <div className="ui-actions">
            <span className="page-header-subtitle">
              {csv.fileName}: {csv.questions.length} soru
            </span>
            <label className="consent-row inline-toggle">
              <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} />
              Cevap anahtarını göster
            </label>
          </div>
          {csv.questions.slice(0, visible).map((q, i) => (
            <QuestionPreview key={i} question={q} number={i + 1} showKey={showKey} />
          ))}
          {visible < csv.questions.length && (
            <Button variant="secondary" onClick={() => setVisible((v) => v + PREVIEW_STEP)}>
              {Math.min(PREVIEW_STEP, csv.questions.length - visible)} soru daha göster
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
