"use client";

import React, { useState } from "react";
import { DoctorQuizAttemptLog, downloadQuizLogsAsCsv } from "@/lib/quiz-parser";

interface AdminCentralAnalyticsProps {
  allAttempts: DoctorQuizAttemptLog[];
  onInspectAttempt?: (attempt: DoctorQuizAttemptLog) => void;
}

/**
 * Admin Merkezi Sınav ve Kullanıcı Log Takip Dashboard'u:
 * - Tüm kullanıcıların ve tüm sınavların (eski + yeni) girişim loglarını filtreleyerek gösterir.
 * - Sekme 1: Tüm Girişim Logları (Hekim, Sınav, Tarih, Süre, Doğru/Toplam, Puan, Sekme Değiştirme, Karne İnceleme)
 * - Sekme 2: Kullanıcı (Hekim) Bazlı Başarı & Katılım Özeti
 * - Sekme 3: Sınav Bazlı Katılım & Ortalama Özeti
 * - Tek tıkla CSV / Excel dışa aktarım
 */
export function AdminCentralAnalytics({
  allAttempts,
  onInspectAttempt,
}: AdminCentralAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<"all_logs" | "by_doctor" | "by_quiz">("all_logs");
  const [selectedQuizFilter, setSelectedQuizFilter] = useState<string>("ALL");
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>("ALL");

  const uniqueQuizzes = Array.from(new Set(allAttempts.map((a) => a.quizTitle)));
  const uniqueDoctors = Array.from(new Set(allAttempts.map((a) => a.doctorName)));

  const filteredAttempts = allAttempts.filter((a) => {
    const qOk = selectedQuizFilter === "ALL" || a.quizTitle === selectedQuizFilter;
    const dOk = selectedDoctorFilter === "ALL" || a.doctorName === selectedDoctorFilter;
    return qOk && dOk;
  });

  const overallAvg = filteredAttempts.length
    ? Math.round(filteredAttempts.reduce((acc, a) => acc + a.score, 0) / filteredAttempts.length)
    : 0;
  const totalTabWarnings = filteredAttempts.filter((a) => a.tabSwitchCount > 0).length;

  // Hekim bazlı özet
  const doctorSummaries = uniqueDoctors.map((docName) => {
    const rows = allAttempts.filter((a) => a.doctorName === docName);
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;
    const best = rows.length ? Math.max(...rows.map((r) => r.score)) : 0;
    const latest = rows[0];
    return {
      doctorName: docName,
      residencyYear: latest?.residencyYear ?? 1,
      attemptCount: rows.length,
      avgScore: avg,
      bestScore: best,
      latestQuiz: latest?.quizTitle ?? "—",
      latestScore: latest?.score ?? 0,
      latestDate: latest?.submittedAt ?? "—",
    };
  });

  // Sınav bazlı özet
  const quizSummaries = uniqueQuizzes.map((qTitle) => {
    const rows = allAttempts.filter((a) => a.quizTitle === qTitle);
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;
    const minScore = rows.length ? Math.min(...rows.map((r) => r.score)) : 0;
    const maxScore = rows.length ? Math.max(...rows.map((r) => r.score)) : 0;
    return {
      quizTitle: qTitle,
      participantCount: rows.length,
      avgScore: avg,
      minScore,
      maxScore,
      lastSubmittedAt: rows[0]?.submittedAt ?? "—",
    };
  });

  return (
    <article className="surface-card" aria-labelledby="central-analytics-heading">
      <div className="page-header" style={{ paddingBottom: "0.85rem", marginBottom: "1rem" }}>
        <div>
          <span className="sec-chip primary">Admin Merkezi Sınav &amp; Kullanıcı Log Dashboard&apos;u</span>
          <h2 id="central-analytics-heading" style={{ marginTop: "0.35rem" }}>
            Tüm Kullanıcı ve Sınav Logları Analitik Paneli
          </h2>
          <p className="page-header-subtitle">
            Toplam Sınav: <strong>{uniqueQuizzes.length}</strong> • Kayıtlı Girişim Logu:{" "}
            <strong>{filteredAttempts.length}</strong> • Ortalama Puan: <strong>{overallAvg} / 100</strong> • Sekme Uyarısı:{" "}
            <strong>{totalTabWarnings}</strong>
          </p>
        </div>
        <button
          id="admin-sync-export-logs-btn"
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => downloadQuizLogsAsCsv(filteredAttempts)}
        >
          Sınav Sonuç Raporunu İndir (Excel / CSV)
        </button>
      </div>

      {/* Sekmeler & Filtreler */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        <div className="mode-switcher" role="tablist" aria-label="Sınav Log Görünümü">
          <button
            id="quiz-admin-log-tab-all"
            type="button"
            className={`mode-btn ${activeTab === "all_logs" ? "active" : ""}`}
            onClick={() => setActiveTab("all_logs")}
          >
            Tüm Sınav Girişim Kayıtları ({filteredAttempts.length})
          </button>
          <button
            id="quiz-admin-log-tab-doctors"
            type="button"
            className={`mode-btn ${activeTab === "by_doctor" ? "active" : ""}`}
            onClick={() => setActiveTab("by_doctor")}
          >
            Asistan Hekim Bazlı Başarı Karnesi ({doctorSummaries.length})
          </button>
          <button
            id="quiz-admin-log-tab-quizzes"
            type="button"
            className={`mode-btn ${activeTab === "by_quiz" ? "active" : ""}`}
            onClick={() => setActiveTab("by_quiz")}
          >
            Sınav Bazlı Başarı Analizi ({quizSummaries.length})
          </button>
        </div>

        {activeTab === "all_logs" && (
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <select
              id="admin-quiz-filter-select"
              className="form-select"
              style={{ width: "220px" }}
              value={selectedQuizFilter}
              onChange={(e) => setSelectedQuizFilter(e.target.value)}
            >
              <option value="ALL">Tüm Sınavlar</option>
              {uniqueQuizzes.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>

            <select
              id="admin-doctor-filter-select"
              className="form-select"
              style={{ width: "200px" }}
              value={selectedDoctorFilter}
              onChange={(e) => setSelectedDoctorFilter(e.target.value)}
            >
              <option value="ALL">Tüm Hekimler</option>
              {uniqueDoctors.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === "all_logs" && (
        <div className="table-wrap">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Hekim</th>
                <th>Kıdem</th>
                <th>Sınav Adı</th>
                <th>Tarih</th>
                <th>Doğru / Toplam</th>
                <th>Puan</th>
                <th>Sekme Değişimi</th>
                <th>Detay</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttempts.map((att) => (
                <tr key={att.attemptId}>
                  <td><strong>{att.doctorName}</strong></td>
                  <td className="mono-num">{att.residencyYear}. Yıl</td>
                  <td>{att.quizTitle}</td>
                  <td className="mono-num">{att.submittedAt}</td>
                  <td className="mono-num">
                    {att.correctCount} / {att.totalQuestions}
                  </td>
                  <td>
                    <span className={`sec-chip mono-num ${att.score >= 70 ? "verified" : "warn"}`}>
                      {att.score}
                    </span>
                  </td>
                  <td className="mono-num">
                    {att.tabSwitchCount > 0 ? (
                      <span className="sec-chip warn">{att.tabSwitchCount} Uyarı</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td>
                    {onInspectAttempt && (
                      <button
                        id={`admin-inspect-attempt-${att.attemptId}`}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onInspectAttempt(att)}
                      >
                        Asistan Karnesini İncele
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "by_doctor" && (
        <div className="table-wrap">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Hekim</th>
                <th>Kıdem</th>
                <th>Katıldığı Sınav Sayısı</th>
                <th>Ortalama Puan</th>
                <th>En Yüksek Puan</th>
                <th>Son Sınav ve Puanı</th>
              </tr>
            </thead>
            <tbody>
              {doctorSummaries.map((d) => (
                <tr key={d.doctorName}>
                  <td><strong>{d.doctorName}</strong></td>
                  <td className="mono-num">{d.residencyYear}. Yıl</td>
                  <td className="mono-num">{d.attemptCount}</td>
                  <td>
                    <span className={`sec-chip mono-num ${d.avgScore >= 70 ? "verified" : "warn"}`}>
                      {d.avgScore}
                    </span>
                  </td>
                  <td className="mono-num">{d.bestScore}</td>
                  <td>
                    {d.latestQuiz} (<strong className="mono-num">{d.latestScore}</strong> • {d.latestDate})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "by_quiz" && (
        <div className="table-wrap">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Sınav Adı</th>
                <th>Katılımcı Sayısı</th>
                <th>Ortalama Puan</th>
                <th>En Düşük / En Yüksek</th>
                <th>Son Teslim Tarihi</th>
              </tr>
            </thead>
            <tbody>
              {quizSummaries.map((q) => (
                <tr key={q.quizTitle}>
                  <td><strong>{q.quizTitle}</strong></td>
                  <td className="mono-num">{q.participantCount} Hekim</td>
                  <td>
                    <span className={`sec-chip mono-num ${q.avgScore >= 70 ? "verified" : "warn"}`}>
                      {q.avgScore}
                    </span>
                  </td>
                  <td className="mono-num">
                    {q.minScore} / {q.maxScore}
                  </td>
                  <td className="mono-num">{q.lastSubmittedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
