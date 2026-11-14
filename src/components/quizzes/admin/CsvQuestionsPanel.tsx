"use client";

import { useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { downloadTextFile } from "@/lib/csv";
import { buildNineFieldCsvTemplate } from "@/lib/quiz-parser";
import { QuestionPreview } from "../QuestionPreview";
import { EditableQuestionList, PREVIEW_STEP } from "./EditableQuestionList";
import type { CsvQuestions, QuestionIssueRow } from "./useCsvQuestions";

/**
 * CSV dosya seçimi + satır numaralı hatalar + eksik görseller + önizleme. "Cevap anahtarını göster"
 * varsayılan KAPALI (projeksiyonda/omuz üstünden yanlışlıkla görünmesin).
 *
 * `editable` (F14, D29; yalnızca "Yeni sınav"): hatalı satırlar da önizlemede görünür ve soru kartında
 * düzeltilir; görsel eklenir, metin ve cevap yapısı değişir, sıra değişir, soru çıkarılır. Verilmezse
 * ("Taslağı düzenle") önizleme salt okunurdur ve hatalı dosya kaydedilemez.
 */
export function CsvQuestionsPanel({
  csv,
  label = "Soru dosyası (CSV)",
  editable = false,
}: {
  csv: CsvQuestions;
  label?: string;
  editable?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [showKey, setShowKey] = useState(false);
  const [visible, setVisible] = useState(PREVIEW_STEP);
  const [replaceWith, setReplaceWith] = useState<File | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ key: string; seq: number } | null>(null);

  function choose(file: File | null) {
    if (editable && csv.dirty && file) {
      setReplaceWith(file);
      return;
    }
    setVisible(PREVIEW_STEP);
    void csv.load(file);
  }

  const columns: Column<QuestionIssueRow>[] = [
    { key: "row", header: "Satır", cell: (e) => (e.row ? e.row : "—") },
    { key: "field", header: "Alan", cell: (e) => e.field },
    { key: "message", header: "Hata", rowHeader: true, cell: (e) => e.message },
  ];
  if (editable) {
    columns.push({
      key: "go",
      header: <span className="sr-only">İşlem</span>,
      align: "end",
      cell: (e) =>
        e.key ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setFocusRequest((r) => ({ key: e.key as string, seq: (r?.seq ?? 0) + 1 }))}
          >
            Soruya git<span className="sr-only"> (Soru {e.number})</span>
          </Button>
        ) : null,
    });
  }

  const hasItems = editable ? csv.items.length > 0 : csv.questions.length > 0 && csv.errors.length === 0;

  return (
    <div className="auth-stack">
      <div className="form-group">
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="form-input"
          aria-describedby={`${inputId}-hint`}
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
        <p id={`${inputId}-hint`} className="ui-field-hint">
          9 sütunlu şablon; `;` veya `,` ayırıcı, UTF-8.{" "}
          {editable
            ? 'Görseli önizlemede soru kartından ekleyebilir ya da "Görseller" sekmesinden yükleyebilirsiniz.'
            : 'Görseller önce "Görseller" sekmesinden yüklenir.'}{" "}
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
          <Alert
            tone="critical"
            title={`${csv.errors.length} hata: ${editable && csv.items.length ? "düzeltilmeden kaydedilemez" : "dosya kaydedilemez"}`}
          >
            {editable && csv.items.length
              ? "Hataları aşağıdaki soru kartlarında düzeltin ya da dosyayı düzeltip yeniden seçin. Sunucu aynı kuralları uygular."
              : "Hataları düzeltip dosyayı yeniden seçin. Sunucu aynı kuralları uygular."}
          </Alert>
          <DataTable<QuestionIssueRow>
            caption="CSV hataları"
            captionHidden
            columns={columns}
            rows={csv.issueRows}
            rowKey={(e) => `${e.key ?? "dosya"}-${e.row}-${e.field}-${e.message}`}
          />
        </>
      )}

      {csv.countProblem && <Alert tone="critical">{csv.countProblem}</Alert>}
      {csv.mediaCheck === "checking" && <p className="page-header-subtitle">Görseller denetleniyor…</p>}
      {csv.mediaCheck === "error" && (
        <Alert tone="critical">
          Görseller denetlenemedi: {csv.mediaError}{" "}
          <Button size="sm" variant="secondary" onClick={csv.retryMediaCheck}>
            Tekrar dene
          </Button>
        </Alert>
      )}
      {csv.missingMedia.length > 0 && (
        <Alert tone="critical" title="Storage'da bulunmayan görseller">
          {csv.missingMedia.map((m) => `Satır ${m.row}: ${m.path}`).join(" · ")}.{" "}
          {editable
            ? "Soru kartından görsel yükleyin veya seçin, ya da görseli kaldırın."
            : 'Önce "Görseller" sekmesinden yükleyin veya yolu düzeltin.'}
        </Alert>
      )}

      {hasItems && (
        <section aria-label="Soru önizlemesi" className="auth-stack">
          <div className="ui-actions">
            <h2 id="csv-preview-heading" tabIndex={-1} className="page-header-subtitle csv-preview-title">
              {csv.fileName}: {editable ? csv.items.length : csv.questions.length} soru
              {editable && csv.dirty ? " (önizlemede düzenlendi)" : ""}
            </h2>
            <label className="consent-row inline-toggle">
              <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} />
              Cevap anahtarını göster
            </label>
          </div>
          {editable ? (
            <EditableQuestionList
              csv={csv}
              showKey={showKey}
              visible={visible}
              setVisible={setVisible}
              focusRequest={focusRequest}
            />
          ) : (
            <>
              {csv.questions.slice(0, visible).map((q, i) => (
                <QuestionPreview key={i} question={q} number={i + 1} showKey={showKey} />
              ))}
              {visible < csv.questions.length && (
                <Button variant="secondary" onClick={() => setVisible(visible + PREVIEW_STEP)}>
                  {Math.min(PREVIEW_STEP, csv.questions.length - visible)} soru daha göster
                </Button>
              )}
            </>
          )}
        </section>
      )}

      <ConfirmDialog
        open={replaceWith !== null}
        onClose={() => {
          setReplaceWith(null);
          if (inputRef.current) inputRef.current.value = "";
        }}
        title="Yeni CSV seçilsin mi?"
        description="Önizlemede yaptığınız değişiklikler (düzenleme, görsel, sıra, çıkarılan sorular) silinir ve yeni dosya yüklenir."
        confirmLabel="Yeni dosyayı yükle"
        tone="danger"
        onConfirm={async () => {
          const file = replaceWith;
          setVisible(PREVIEW_STEP);
          await csv.load(file);
        }}
      />
    </div>
  );
}
