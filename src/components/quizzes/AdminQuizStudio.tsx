"use client";

import React, { useState } from "react";
import {
  NineFieldClinicalQuestion,
  QuizQuestionInput,
  CsvRowError,
  parseNineFieldQuizCsv,
  buildNineFieldCsvTemplate,
  NINE_FIELD_CSV_HEADERS,
} from "@/lib/quiz-parser";
import { downloadCsv, downloadTextFile } from "@/lib/csv";

interface AdminQuizStudioProps {
  activeQuizTitle: string;
  activeQuizDurationMinutes: number;
  activeQuestions: NineFieldClinicalQuestion[];
  archivedQuestions: Array<NineFieldClinicalQuestion & { sourceQuizTitle: string; archivedAt: string }>;
  onPublishQuizFromCsv: (newQuizTitle: string, durationMinutes: number, questions: NineFieldClinicalQuestion[]) => void;
}

/**
 * Admin CSV Yükleme, Önizleme, Süre Belirleme ve Yayına Alma Stüdyosu:
 * 1) Admin 9 sütunlu yapıda (.csv) dosyasını yükler (veya örnek şablonu indirir / yükler).
 * 2) Sistem 9 alanı (`parseNineFieldQuizCsv`) satır bazında doğrular ve ÖNİZLEME ekranını açar.
 * 3) Admin sınav başlığını ve SINAV SÜRESİNİ (dakika) belirler, soruları önizler ve yayına alır.
 * 4) Yayına alındığında önceki aktif sınavın soruları 9 alanlı yapısıyla `quiz_question_archive` içine arşivlenir.
 */
export function AdminQuizStudio({
  activeQuizTitle,
  activeQuizDurationMinutes,
  activeQuestions,
  archivedQuestions,
  onPublishQuizFromCsv,
}: AdminQuizStudioProps) {
  const [quizTitleInput, setQuizTitleInput] = useState<string>(
    "Kasım 2026 — 2. Hafta Pediatrik Acil ve Kardiyoloji Vaka Sınavı"
  );
  const [durationMinutesInput, setDurationMinutesInput] = useState<number>(20);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [previewQuestions, setPreviewQuestions] = useState<QuizQuestionInput[]>([]);
  const [csvErrors, setCsvErrors] = useState<CsvRowError[]>([]);
  const [showAnswerKeyInPreview, setShowAnswerKeyInPreview] = useState<boolean>(true);
  const [publishBanner, setPublishBanner] = useState<string>("");

  const handleCsvTextLoaded = (csvText: string, fileName: string) => {
    setUploadedFileName(fileName);
    setPublishBanner("");
    const parsed = parseNineFieldQuizCsv(csvText);
    setPreviewQuestions(parsed.questions);
    setCsvErrors(parsed.errors);
  };

  const handleDownloadSampleCsv = () =>
    downloadTextFile("pediatrist_9_sutun_sinav_sablonu.csv", buildNineFieldCsvTemplate(), "text/csv;charset=utf-8");

  const canPublish =
    quizTitleInput.trim().length > 0 &&
    durationMinutesInput >= 1 &&
    durationMinutesInput <= 180 &&
    previewQuestions.length > 0 &&
    csvErrors.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Mevcut Yayındaki Sınav Bilgisi */}
      <article className="surface-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div>
            <span className="sec-chip success">Yayındaki Aktif Sınav</span>
            <h2 style={{ marginTop: "0.4rem" }}>{activeQuizTitle}</h2>
            <p className="page-header-subtitle">
              Soru Sayısı: <strong>{activeQuestions.length}</strong> • Admin Belirlenen Sınav Süresi:{" "}
              <strong>{activeQuizDurationMinutes} dakika</strong>
            </p>
          </div>
          <button
            id="download-sample-9field-csv-btn"
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDownloadSampleCsv}
          >
            Sınav Soru Şablonunu İndir (.CSV)
          </button>
        </div>
      </article>

      {/* ADIM 1: CSV YÜKLEME VE SÜRE BELİRLEME */}
      <article className="surface-card" aria-labelledby="csv-upload-heading">
        <span className="sec-chip info">Adım 1 • CSV Yükle &amp; Sınav Süresini Belirle</span>
        <h2 id="csv-upload-heading" style={{ marginTop: "0.45rem" }}>
          CSV Dosyası ile Yeni Klinik Vaka Sınavı Oluştur
        </h2>
        <p className="page-header-subtitle" style={{ marginBottom: "1rem" }}>
          Mevcut 9 sütunlu sınav yapısına (<code>{NINE_FIELD_CSV_HEADERS.join(" | ")}</code>) uygun CSV dosyanızı
          yükleyin, sınav süresini belirleyin ve önizleme sonrası yayına alın.
        </p>

        <div className="grid-2">
          <div className="form-group">
            <label htmlFor="admin-csv-quiz-title" className="form-label">
              Yayına Alınacak Sınav Başlığı
            </label>
            <input
              id="admin-csv-quiz-title"
              type="text"
              className="form-input"
              value={quizTitleInput}
              onChange={(e) => setQuizTitleInput(e.target.value)}
              placeholder="Örn: Kasım 2026 — 2. Hafta Çocuk Acil Sınavı"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-csv-quiz-duration" className="form-label">
              Sınav Süresi (Dakika • 1–180 dk)
            </label>
            <input
              id="admin-csv-quiz-duration"
              type="number"
              min={1}
              max={180}
              className="form-input mono-num"
              value={durationMinutesInput}
              onChange={(e) => setDurationMinutesInput(Math.max(1, Math.min(180, Number(e.target.value) || 15)))}
              required
            />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: "0.5rem" }}>
          <label htmlFor="admin-csv-file-input" className="form-label">
            9 Sütunlu Sınav CSV Dosyası Seçin (<code>.csv</code>)
          </label>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <input
              id="admin-csv-file-input"
              type="file"
              accept=".csv,text/csv"
              className="form-input"
              style={{ maxWidth: "420px" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  handleCsvTextLoaded(String(reader.result || ""), file.name);
                };
                reader.readAsText(file, "utf-8");
              }}
            />
            <button
              id="load-sample-csv-preview-btn"
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleCsvTextLoaded(buildNineFieldCsvTemplate(), "ornek_9_sutun_klinik_vaka.csv")}
            >
              Örnek Vaka Setini Yükle ve Önizle
            </button>
          </div>
          {uploadedFileName && (
            <p className="page-header-subtitle mono-num" style={{ marginTop: "0.4rem", fontSize: "0.8rem" }}>
              Yüklenen Dosya: <strong>{uploadedFileName}</strong> • Geçerli Soru:{" "}
              <strong>{previewQuestions.length}</strong> • Hata: <strong>{csvErrors.length}</strong>
            </p>
          )}
        </div>

        {csvErrors.length > 0 && (
          <div
            role="alert"
            style={{
              padding: "0.9rem",
              borderRadius: "var(--radius-md)",
              background: "var(--status-critical-bg)",
              color: "var(--status-critical)",
              marginTop: "0.75rem",
            }}
          >
            <strong>CSV Doğrulama Hataları ({csvErrors.length} adet) — Yayına almadan önce düzeltiniz:</strong>
            <ul style={{ paddingLeft: "1.2rem", marginTop: "0.4rem", fontSize: "0.83rem" }}>
              {csvErrors.map((err, idx) => (
                <li key={idx}>
                  Satır {err.row} ({err.field}): {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {publishBanner && (
          <div
            role="status"
            style={{
              padding: "0.9rem",
              borderRadius: "var(--radius-md)",
              background: "var(--status-success-bg)",
              color: "var(--status-success)",
              fontWeight: 600,
              marginTop: "0.75rem",
            }}
          >
            {publishBanner}
          </div>
        )}
      </article>

      {/* ADIM 2: ÖNİZLEME VE YAYINA ALMA */}
      {previewQuestions.length > 0 && (
        <article className="surface-card" aria-labelledby="csv-preview-heading">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <span className="sec-chip success">Adım 2 • Sınav Önizleme ({previewQuestions.length} Soru)</span>
              <h2 id="csv-preview-heading" style={{ marginTop: "0.4rem" }}>
                Önizleme: {quizTitleInput} ({durationMinutesInput} dk)
              </h2>
              <p className="page-header-subtitle">
                Soruları asistan hekimlerin göreceği biçimde kontrol edin. Onayladığınızda sınav yayına alınır ve önceki
                sınav arşivlenir.
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
              <label
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", fontWeight: 600 }}
              >
                <input
                  type="checkbox"
                  checked={showAnswerKeyInPreview}
                  onChange={(e) => setShowAnswerKeyInPreview(e.target.checked)}
                />
                Cevap Anahtarı &amp; Öğrenme Noktalarını Göster
              </label>

              <button
                id="publish-previewed-quiz-btn"
                type="button"
                className="btn btn-primary"
                disabled={!canPublish}
                onClick={() => {
                  if (!canPublish) return;
                  const formatted: NineFieldClinicalQuestion[] = previewQuestions.map((q, idx) => ({
                    ...q,
                    id: `q_csv_${Date.now()}_${idx + 1}`,
                    orderIndex: idx + 1,
                  }));
                  onPublishQuizFromCsv(quizTitleInput.trim(), durationMinutesInput, formatted);
                  setPreviewQuestions([]);
                  setUploadedFileName("");
                  setPublishBanner(
                    `✓ "${quizTitleInput.trim()}" (${durationMinutesInput} dk, ${formatted.length} soru) başarıyla yayına alındı ve önceki sınav soruları arşive taşındı.`
                  );
                }}
              >
                Sınavı Onayla ve Yayına Al ({durationMinutesInput} dk)
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {previewQuestions.map((q, idx) => (
              <div
                key={idx}
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-canvas)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span className="sec-chip info">
                    Soru {idx + 1} • {q.questionType}
                  </span>
                  {q.questionType === "Text Input" && (
                    <span className="sec-chip mono-num">Max Length: {q.maxLength} karakter</span>
                  )}
                </div>

                <p style={{ marginTop: "0.6rem", fontSize: "0.9rem" }}>
                  <strong>1. Klinik Vaka:</strong> {q.caseContent}
                </p>
                {q.imageUrl && (
                  <p
                    className="mono-num"
                    style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}
                  >
                    <strong>2. Görsel:</strong> {q.imageUrl}
                  </p>
                )}
                <p style={{ marginTop: "0.45rem", fontWeight: 700 }}>3. Soru: {q.questionText}</p>

                {q.optionsArray.length > 0 && (
                  <ul style={{ paddingLeft: "1.2rem", marginTop: "0.45rem", fontSize: "0.85rem" }}>
                    {q.optionsArray.map((opt, oIdx) => (
                      <li key={oIdx}>{opt}</li>
                    ))}
                  </ul>
                )}

                {showAnswerKeyInPreview && (
                  <div
                    style={{
                      marginTop: "0.65rem",
                      padding: "0.65rem",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--status-success-bg)",
                      fontSize: "0.82rem",
                    }}
                  >
                    <div>
                      <strong>8. Doğru Seçenek (JSON):</strong> <code>{JSON.stringify(q.correctAnswers)}</code>
                    </div>
                    <div style={{ marginTop: "0.25rem" }}>
                      <strong>9. Öğrenme Noktası (Feedback_Text):</strong> {q.feedbackText}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </article>
      )}

      {/* KAYIP ÖNLEYİCİ 9 ALANLI SORU ARŞİVİ */}
      <article className="surface-card" aria-labelledby="archive-heading">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "0.85rem",
          }}
        >
          <div>
            <h2 id="archive-heading">
              Kayıp Önleyici 9 Alanlı Soru Arşivi ({archivedQuestions.length} Arşivlenmiş Soru)
            </h2>
            <p className="page-header-subtitle">
              Yeni bir CSV sınavı yayına alındığında önceki sınavın soruları silinmez; 9 alanlı yapısıyla otomatik
              olarak bu arşive aktarılır.
            </p>
          </div>
          <button
            id="export-archive-csv-btn"
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              downloadCsv(
                "pediatrist_9_sutun_soru_arsivi.csv",
                [...NINE_FIELD_CSV_HEADERS, "KaynakSinav", "ArsivTarihi"],
                archivedQuestions.map((q) => [
                  q.caseContent,
                  q.imageUrl,
                  q.questionText,
                  q.questionType,
                  q.maxLength || "",
                  q.optionsRaw,
                  JSON.stringify(q.optionsArray),
                  JSON.stringify(q.correctAnswers),
                  q.feedbackText,
                  q.sourceQuizTitle,
                  q.archivedAt,
                ])
              )
            }
          >
            Soru Arşivini CSV Olarak İndir
          </button>
        </div>

        <div className="table-wrap">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Arşiv Tarihi</th>
                <th>Kaynak Sınav</th>
                <th>Soru Tipi</th>
                <th>Klinik Vaka &amp; Soru Özeti</th>
                <th>Doğru Yanıt (8. Alan)</th>
              </tr>
            </thead>
            <tbody>
              {archivedQuestions.map((aq) => (
                <tr key={aq.id}>
                  <td className="mono-num">{aq.archivedAt}</td>
                  <td>{aq.sourceQuizTitle}</td>
                  <td>
                    <span className="sec-chip info">{aq.questionType}</span>
                  </td>
                  <td>
                    <strong>{aq.questionText}</strong>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      {aq.caseContent.slice(0, 110)}…
                    </div>
                  </td>
                  <td className="mono-num">
                    <code>{JSON.stringify(aq.correctAnswers)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
