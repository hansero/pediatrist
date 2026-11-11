"use client";

import React from "react";
import { DoctorQuizAttemptLog } from "@/lib/quiz-parser";

interface InstantFeedbackReportProps {
  attempt: DoctorQuizAttemptLog;
  onBackToDashboard: () => void;
}

/**
 * Sınav Sonu Anında Açılan Klinik Öğrenme Karnesi:
 * Sorunun doğru veya yanlış yapılmasından bağımsız olarak her vakanın altında
 * yer alan Klinik Öğrenme Noktası (Feedback_Text) hekime gösterilir.
 */
export function InstantFeedbackReport({ attempt, onBackToDashboard }: InstantFeedbackReportProps) {
  return (
    <section
      aria-labelledby="feedback-report-heading"
      style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}
    >
      <article className="surface-card">
        <div className="page-header" style={{ paddingBottom: "0.85rem" }}>
          <div>
            <span className={`sec-chip ${attempt.score >= 70 ? "success" : "warning"}`}>
              Sınav Sonuç ve Klinik Öğrenme Karnesi
            </span>
            <h2 id="feedback-report-heading" style={{ marginTop: "0.5rem" }}>
              {attempt.quizTitle} — Başarı Puanı: {attempt.score} / 100
            </h2>
            <p className="page-header-subtitle">
              Hekim: <strong>{attempt.doctorName}</strong> • Doğru Vaka:{" "}
              <strong>
                {attempt.correctCount} / {attempt.totalQuestions}
              </strong>{" "}
              • Her olgunun altında doğru/yanlış bağımsız <strong>Klinik Öğrenme Noktası</strong> yer almaktadır.
            </p>
          </div>
          <button
            id="feedback-back-dashboard-btn"
            type="button"
            className="btn btn-primary"
            onClick={onBackToDashboard}
          >
            &larr; Sınav Sonuçları Paneline Dön
          </button>
        </div>
      </article>

      {attempt.gradedReport.map((item, idx) => (
        <article key={item.questionId} className="surface-card">
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}
          >
            <span className="mono-num" style={{ fontWeight: 700 }}>
              Vaka {idx + 1}
            </span>
            <span className={`sec-chip ${item.isCorrect ? "success" : "critical"}`}>
              {item.isCorrect ? "Doğru Yanıt ✓" : "Gözden Geçirilmeli ✗"}
            </span>
          </div>

          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            {item.caseContent}
          </p>
          <h3 style={{ marginBottom: "0.75rem" }}>{item.questionText}</h3>

          <div className="grid-2" style={{ gap: "0.75rem", marginBottom: "0.85rem" }}>
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "var(--radius-sm)",
                background: item.isCorrect ? "var(--status-success-bg)" : "var(--status-critical-bg)",
                fontSize: "0.84rem",
              }}
            >
              <strong>Verilen Yanıt:</strong>{" "}
              {item.userResponse.length ? item.userResponse.join(", ") : "(Yanıt Bırakılmadı)"}
            </div>
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--status-success-bg)",
                fontSize: "0.84rem",
              }}
            >
              <strong>Klinik Doğru Yaklaşım / Yanıt:</strong>{" "}
              {item.correctAnswers ? item.correctAnswers.join(" | ") : "Sınav kapandığında görünür."}
            </div>
          </div>

          {/* 9. Alan: Doğru/Yanlış Bağımsız Pedagojik Öğrenme Noktası */}
          <div
            style={{
              padding: "0.95rem",
              borderRadius: "var(--radius-md)",
              background: "var(--clinical-primary-soft)",
              border: "1px solid hsla(204, 88%, 36%, 0.25)",
              fontSize: "0.88rem",
            }}
          >
            <strong style={{ color: "var(--clinical-primary)" }}>Klinik Öğrenme Noktası:</strong>
            <p style={{ marginTop: "0.3rem" }}>{item.feedbackText ?? "Sınav kapandığında görünür."}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
