"use client";

import React, { useEffect, useRef, useState } from "react";
import { NineFieldClinicalQuestion, QuizQuestionType } from "@/lib/quiz-parser";

interface ClinicalExamRunnerProps {
  quizTitle: string;
  durationMinutes: number;
  questions: NineFieldClinicalQuestion[];
  onSubmitExam: (responses: Record<string, string[]>, tabSwitchCount: number) => void;
  onCancel: () => void;
}

function formatQuestionTypeLabel(qType: QuizQuestionType): string {
  if (qType === "Single Choice") return "Tek Seçmeli Klinik Vaka";
  if (qType === "Multiple Choice") return "Çoklu Seçmeli Klinik Vaka (Birden Fazla Doğru Seçilebilir)";
  return "Açık Uçlu Tanı / Tedavi Yanıtı";
}

/**
 * Pediatri Asistanı Klinik Vaka Sınav Ekranı:
 * - Admin tarafından belirlenen süre (`durationMinutes`) ile kesintisiz geri sayım sayacı.
 * - Stale-closure önleyici `useRef` mimarisi: şık seçildiğinde sayaç sıfırlanmaz veya takılmaz.
 * - Soru Gezgini (Question Progress Navigator): yanıtlanan ve boş kalan vakaları anlık gösterir.
 */
export function ClinicalExamRunner({
  quizTitle,
  durationMinutes,
  questions,
  onSubmitExam,
  onCancel,
}: ClinicalExamRunnerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(Math.max(60, durationMinutes * 60));
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);
  const [responses, setResponses] = useState<Record<string, string[]>>({});
  const [confirmUnansweredWarning, setConfirmUnansweredWarning] = useState<boolean>(false);

  const responsesRef = useRef(responses);
  responsesRef.current = responses;
  const tabSwitchRef = useRef(tabSwitchCount);
  tabSwitchRef.current = tabSwitchCount;
  const onSubmitRef = useRef(onSubmitExam);
  onSubmitRef.current = onSubmitExam;

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onSubmitRef.current(responsesRef.current, tabSwitchRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitchCount((c) => c + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  const answeredCount = questions.filter((q) => {
    const ans = responses[q.id];
    return Array.isArray(ans) && ans.some((v) => v.trim().length > 0);
  }).length;
  const progressPct = Math.round((answeredCount / (questions.length || 1)) * 100);

  const handleSingleChoice = (qId: string, option: string) => {
    setConfirmUnansweredWarning(false);
    setResponses((prev) => ({ ...prev, [qId]: [option] }));
  };

  const handleMultipleChoice = (qId: string, option: string) => {
    setConfirmUnansweredWarning(false);
    setResponses((prev) => {
      const current = prev[qId] || [];
      const exists = current.includes(option);
      const next = exists ? current.filter((o) => o !== option) : [...current, option];
      return { ...prev, [qId]: next };
    });
  };

  const handleTextInput = (qId: string, text: string, maxLen: number) => {
    setConfirmUnansweredWarning(false);
    setResponses((prev) => ({ ...prev, [qId]: [text.slice(0, maxLen || 250)] }));
  };

  const handleAttemptSubmit = () => {
    if (answeredCount < questions.length && !confirmUnansweredWarning) {
      setConfirmUnansweredWarning(true);
      return;
    }
    onSubmitExam(responses, tabSwitchCount);
  };

  return (
    <section aria-labelledby="exam-runner-heading" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      {/* Üst Sabit Sınav Sayaç ve Soru Gezgini Çubuğu */}
      <div
        className="surface-card"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          position: "sticky",
          top: "12px",
          zIndex: 15,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span className="sec-chip primary">Aktif Klinik Vaka Sınavı</span>
            <h2 id="exam-runner-heading" style={{ marginTop: "0.35rem" }}>
              {quizTitle}
            </h2>
          </div>

          <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
            <span className={`sec-chip mono-num ${tabSwitchCount > 0 ? "warn" : "verified"}`}>
              Ekran Değişimi: {tabSwitchCount}
            </span>
            <span className="sec-chip critical mono-num" style={{ fontSize: "0.94rem" }}>
              Kalan Süre: <strong>{mins}:{secs}</strong>
            </span>
            <button id="exam-cancel-btn" type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
              Sınavdan Ayrıl
            </button>
          </div>
        </div>

        {/* İlerleme Çubuğu ve Hızlı Soru Gezgini */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.35rem" }}>
            <span>
              Yanıtlanan Vaka: <strong className="mono-num">{answeredCount} / {questions.length}</strong>
            </span>
            <span className="mono-num">%{progressPct} Tamamlandı</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="question-nav-bar" style={{ marginTop: "0.6rem" }}>
            {questions.map((q, idx) => {
              const isAns = (responses[q.id] || []).some((v) => v.trim().length > 0);
              return (
                <button
                  key={q.id}
                  id={`exam-nav-pill-${idx + 1}`}
                  type="button"
                  className={`question-nav-pill mono-num ${isAns ? "answered" : ""}`}
                  onClick={() => {
                    const el = document.getElementById(`question-card-${q.id}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sorular Listesi */}
      {questions.map((q, idx) => {
        const selectedList = responses[q.id] || [];
        const typedText = selectedList[0] || "";
        return (
          <article key={q.id} id={`question-card-${q.id}`} className="surface-card" aria-labelledby={`q-stem-${q.id}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.65rem" }}>
              <span className="sec-chip primary mono-num">Vaka {idx + 1} / {questions.length}</span>
              <span className="sec-chip">
                {formatQuestionTypeLabel(q.questionType)}
              </span>
            </div>

            {/* 1. Alan: Klinik Vaka Sunumu */}
            <div
              style={{
                padding: "0.95rem",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface-subtle)",
                border: "1px solid var(--border-subtle)",
                marginBottom: "0.85rem",
                fontSize: "0.92rem",
              }}
            >
              <strong>Klinik Olgu Sunumu:</strong>
              <p style={{ marginTop: "0.3rem" }}>{q.caseContent}</p>
            </div>

            {/* 2. Alan: Opsiyonel Klinik veya Radyoloji Görseli */}
            {q.imageUrl ? (
              <div
                style={{
                  marginBottom: "0.85rem",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px dashed var(--border-strong)",
                  fontSize: "0.82rem",
                  background: "var(--bg-canvas)",
                }}
              >
                <strong>Ekli Klinik / Radyolojik Bulgu Görseli:</strong>{" "}
                <span className="mono-num">{q.imageUrl.replace(/^quiz_media\//, "")}</span>
              </div>
            ) : null}

            {/* 3. Alan: Sorunun Kendi */}
            <h3 id={`q-stem-${q.id}`} style={{ marginBottom: "0.85rem" }}>
              {q.questionText}
            </h3>

            {/* 4–7. Alanlar: Soru Tipine Göre Girdi */}
            {q.questionType === "Single Choice" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {q.optionsArray.map((opt, optIdx) => {
                  const checked = selectedList.includes(opt);
                  return (
                    <label
                      key={optIdx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        padding: "0.7rem 0.9rem",
                        borderRadius: "var(--radius-sm)",
                        border: checked ? "2px solid var(--clinical-primary)" : "1px solid var(--border-subtle)",
                        background: checked ? "var(--clinical-primary-soft)" : "var(--bg-surface)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        id={`q-${q.id}-single-${optIdx}`}
                        type="radio"
                        name={`q-${q.id}`}
                        checked={checked}
                        onChange={() => handleSingleChoice(q.id, opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.questionType === "Multiple Choice" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {q.optionsArray.map((opt, optIdx) => {
                  const checked = selectedList.includes(opt);
                  return (
                    <label
                      key={optIdx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        padding: "0.7rem 0.9rem",
                        borderRadius: "var(--radius-sm)",
                        border: checked ? "2px solid var(--clinical-primary)" : "1px solid var(--border-subtle)",
                        background: checked ? "var(--clinical-primary-soft)" : "var(--bg-surface)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        id={`q-${q.id}-multi-${optIdx}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleMultipleChoice(q.id, opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.questionType === "Text Input" && (
              <div>
                <input
                  id={`q-${q.id}-text-input`}
                  type="text"
                  maxLength={q.maxLength || 150}
                  className="form-input"
                  placeholder="Klinik tanı veya tedavi yanıtınızı buraya yazınız..."
                  value={typedText}
                  onChange={(e) => handleTextInput(q.id, e.target.value, q.maxLength || 150)}
                />
                <div className="mono-num" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.3rem", textAlign: "right" }}>
                  Karakter Sayısı: {typedText.length} / {q.maxLength || 150}
                </div>
              </div>
            )}
          </article>
        );
      })}

      {confirmUnansweredWarning && (
        <div role="alert" className="clinical-alert warn">
          Henüz yanıtlamadığınız {questions.length - answeredCount} vaka sorusu bulunuyor. Yine de sınavı teslim etmek istiyorsanız aşağıdaki butona tekrar tıklayın.
        </div>
      )}

      <button
        id="quiz-submit-attempt-btn"
        type="button"
        className="btn btn-primary"
        style={{ padding: "0.9rem", fontSize: "0.96rem" }}
        onClick={handleAttemptSubmit}
      >
        {confirmUnansweredWarning
          ? "Evet, Boş Sorularla Birlikte Sınavı Şimdi Teslim Et"
          : "Sınavı Teslim Et ve Vaka Çözümlerini Gör"}
      </button>
    </section>
  );
}
