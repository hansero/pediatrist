"use client";

import React from "react";
import { DoctorQuizAttemptLog } from "@/lib/quiz-parser";
import { ClinicMemberSession } from "@/components/security/SessionGuard";

interface DoctorGrowthDashboardProps {
  session: ClinicMemberSession;
  personalAttempts: DoctorQuizAttemptLog[];
  activeQuizTitle: string;
  activeQuizQuestionCount: number;
  activeQuizDurationMinutes: number;
  onStartActiveQuiz: () => void;
  onInspectAttemptReport: (attempt: DoctorQuizAttemptLog) => void;
}

/**
 * Pediatri Asistanı (User) Kişisel Sınav ve Gelişim Paneli:
 * - Asistan yalnızca yayındaki sınava katılır ve kendi eski + şimdiki sınav loglarını takip eder.
 * - Diğer asistanların sonuçlarına erişim hem arayüzde hem Firestore kurallarında kapalıdır.
 */
export function DoctorGrowthDashboard({
  session,
  personalAttempts,
  activeQuizTitle,
  activeQuizQuestionCount,
  activeQuizDurationMinutes,
  onStartActiveQuiz,
  onInspectAttemptReport,
}: DoctorGrowthDashboardProps) {
  const ordered = [...personalAttempts].reverse();
  const avgScore = ordered.length
    ? Math.round(ordered.reduce((acc, a) => acc + a.score, 0) / ordered.length)
    : 0;
  const bestScore = ordered.length ? Math.max(...ordered.map((a) => a.score)) : 0;
  const latestScore = personalAttempts[0]?.score ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Üst: Aktif Sınav Kartı & Kişisel Başarı Eğrisi */}
      <div className="grid-2">
        <article className="surface-card" aria-labelledby="active-quiz-card-heading">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <span className="sec-chip verified">Yayındaki Haftalık Klinik Sınav</span>
            <span className="sec-chip mono-num">
              {activeQuizQuestionCount} Klinik Vaka • {activeQuizDurationMinutes} Dakika
            </span>
          </div>
          <h2 id="active-quiz-card-heading" style={{ marginTop: "0.65rem" }}>
            {activeQuizTitle}
          </h2>
          <p className="page-header-subtitle" style={{ margin: "0.45rem 0 1.1rem" }}>
            Tek seçmeli, çoklu seçmeli ve açık uçlu klinik vaka sorularından oluşur. Sınavı teslim ettiğiniz anda her vakanın doğru yanıtı ve <strong>Klinik Öğrenme Noktası</strong> karnenizde açılır.
          </p>
          <button
            id="start-active-quiz-btn"
            type="button"
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={onStartActiveQuiz}
          >
            Sınava Katıl ve Vakaları Çözmeye Başla ({activeQuizDurationMinutes} Dk) &rarr;
          </button>
        </article>

        <article className="surface-card" aria-labelledby="personal-curve-heading">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 id="personal-curve-heading">
              Kişisel Gelişim Özeti ({session.title} {session.fullName})
            </h2>
            <span className="sec-chip primary mono-num">Genel Ortalama: {avgScore} / 100</span>
          </div>

          <div className="grid-3" style={{ marginTop: "0.75rem", marginBottom: "0.85rem" }}>
            <div style={{ padding: "0.65rem", borderRadius: "var(--radius-sm)", background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
              <div className="metric-label">Katıldığım Sınav</div>
              <div className="mono-num" style={{ fontSize: "1.15rem", fontWeight: 800 }}>{personalAttempts.length}</div>
            </div>
            <div style={{ padding: "0.65rem", borderRadius: "var(--radius-sm)", background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
              <div className="metric-label">Son Sınav Puanım</div>
              <div className="mono-num" style={{ fontSize: "1.15rem", fontWeight: 800 }}>{latestScore}</div>
            </div>
            <div style={{ padding: "0.65rem", borderRadius: "var(--radius-sm)", background: "var(--bg-surface-subtle)", border: "1px solid var(--border-subtle)" }}>
              <div className="metric-label">En Yüksek Puanım</div>
              <div className="mono-num" style={{ fontSize: "1.15rem", fontWeight: 800 }}>{bestScore}</div>
            </div>
          </div>

          {/* Kişisel Başarı Eğrisi Grafiği */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "0.85rem",
              height: "115px",
              padding: "0.75rem",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-surface-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {ordered.map((att) => (
              <div
                key={att.attemptId}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <span className="mono-num" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                  {att.score}
                </span>
                <div
                  style={{
                    width: "100%",
                    maxWidth: "46px",
                    height: `${Math.max(16, Math.round(att.score * 0.65))}px`,
                    background: "var(--clinical-primary)",
                    borderRadius: "6px 6px 0 0",
                  }}
                />
                <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textAlign: "center" }}>
                  {att.submittedAt}
                </span>
              </div>
            ))}
          </div>
        </article>
      </div>

      {/* Alt: Eski ve Şimdiki Sınav Loglarım Dashboard'u */}
      <article className="surface-card" aria-labelledby="past-exams-heading">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <div>
            <h2 id="past-exams-heading">
              Eski ve Güncel Sınav Sonuçlarım (Kişisel Sınav Loglarım)
            </h2>
            <p className="page-header-subtitle">
              Tamamladığınız tüm sınavların tarih, doğru sayısı, puan ve vaka bazlı öğrenme karnelerine buradan ulaşabilirsiniz.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Teslim Tarihi</th>
                <th>Sınav Adı</th>
                <th>Doğru / Toplam Vaka</th>
                <th>Başarı Puanı</th>
                <th>Vaka Çözümleri &amp; Karne</th>
              </tr>
            </thead>
            <tbody>
              {personalAttempts.map((att) => (
                <tr key={att.attemptId}>
                  <td className="mono-num">{att.submittedAt}</td>
                  <td><strong>{att.quizTitle}</strong></td>
                  <td className="mono-num">
                    {att.correctCount} / {att.totalQuestions}
                  </td>
                  <td>
                    <span className={`sec-chip mono-num ${att.score >= 70 ? "verified" : "warn"}`}>
                      {att.score} / 100
                    </span>
                  </td>
                  <td>
                    <button
                      id={`inspect-attempt-btn-${att.attemptId}`}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onInspectAttemptReport(att)}
                    >
                      Vaka Çözümlerini ve Öğrenme Karnesini Aç
                    </button>
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
