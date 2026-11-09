"use client";

import React, { useState } from "react";
import { downloadCsv } from "@/lib/firebase/hooks";

export interface AttendanceRecordItem {
  uid: string;
  fullName: string;
  title: string;
  residencyYear: number;
  verifiedAt: string;
  method: "qr+webauthn" | "qr+device_bound" | "admin_excused";
  status: "present" | "excused";
  excuseNote?: string;
}

export interface AttendanceSessionItem {
  id: string;
  title: string;
  lecturer: string;
  category: string;
  dateStr: string;
  durationMinutes: number;
  status: "live" | "closed";
  hmacSlotCode: string;
  secondsUntilRotation: number;
  records: Record<string, AttendanceRecordItem>;
}

export interface ClinicRosterMember {
  uid: string;
  fullName: string;
  title: string;
  residencyYear: number;
  hasBoundDevice: boolean;
}

interface AdminLiveAttendanceProjectorProps {
  liveSession: AttendanceSessionItem | null;
  allSessions: AttendanceSessionItem[];
  clinicRoster: ClinicRosterMember[];
  onStartNewSession: (title: string, lecturer: string, category: string, durationMinutes: number) => void;
  onEndLiveSession: (sessionId: string) => void;
  onMarkExcused: (sessionId: string, uid: string, excuseNote: string) => void;
}

/**
 * Yönetici (Admin) Ders Katılım Yönetimi ve Analitik Dashboard:
 * 1) Yoklama alınacak dersi YALNIZCA Admin başlatır (`startLectureSession`) ve süresini belirler.
 * 2) Canlı ders sırasında 15 saniyede bir yenilenen dinamik QR / 6 haneli kod projektörde gösterilir.
 * 3) Admin Katılım Takip Dashboard'u:
 *    - Sekme A: Ders Bazlı Katılım Logları (her dersin katılım oranı, katılan/mazeretli/katılmayan detayı, CSV indirme)
 *    - Sekme B: Katılımcı (Hekim) Bazlı Katılım Logları (her hekimin katıldığı/toplam ders sayısı, katılım yüzdesi, ders geçmişi, CSV indirme)
 */
export function AdminLiveAttendanceProjector({
  liveSession,
  allSessions,
  clinicRoster,
  onStartNewSession,
  onEndLiveSession,
  onMarkExcused,
}: AdminLiveAttendanceProjectorProps) {
  const [dashboardTab, setDashboardTab] = useState<"projector" | "by_lecture" | "by_participant">("projector");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newLecturer, setNewLecturer] = useState<string>("Prof. Dr. Selim Kaya");
  const [newCategory, setNewCategory] = useState<string>("Sabah Vaka & Makale Saati");
  const [newDuration, setNewDuration] = useState<number>(15);
  const [excuseNotes, setExcuseNotes] = useState<Record<string, string>>({});
  const [selectedLectureId, setSelectedLectureId] = useState<string>(allSessions[0]?.id || "");
  const [selectedDoctorUid, setSelectedDoctorUid] = useState<string>(clinicRoster[0]?.uid || "");

  const totalDoctors = clinicRoster.length || 1;
  const totalSessionsCount = allSessions.length || 1;

  // Genel KPI hesaplamaları
  const overallPresentAndExcused = allSessions.reduce((acc, s) => {
    const cnt = Object.values(s.records).filter((r) => r.status === "present" || r.status === "excused").length;
    return acc + cnt;
  }, 0);
  const averageAttendanceRate = Math.round((overallPresentAndExcused / (totalSessionsCount * totalDoctors)) * 100);

  // Katılımcı bazlı özet
  const participantSummaries = clinicRoster.map((member) => {
    let presentCount = 0;
    let excusedCount = 0;
    let lastAttendedDate = "—";

    const logs = allSessions.map((sess) => {
      const rec = sess.records[member.uid];
      if (rec?.status === "present") {
        presentCount++;
        if (lastAttendedDate === "—") lastAttendedDate = `${sess.dateStr} (${rec.verifiedAt})`;
      } else if (rec?.status === "excused") {
        excusedCount++;
      }
      return {
        sessionId: sess.id,
        sessionTitle: sess.title,
        lecturer: sess.lecturer,
        category: sess.category,
        dateStr: sess.dateStr,
        status: rec?.status ?? "absent",
        verifiedAt: rec?.verifiedAt ?? "—",
        method: rec?.method ?? "—",
        excuseNote: rec?.excuseNote ?? "",
      };
    });

    const attendedTotal = presentCount + excusedCount;
    const rate = Math.round((attendedTotal / totalSessionsCount) * 100);
    return {
      member,
      presentCount,
      excusedCount,
      absentCount: Math.max(0, allSessions.length - attendedTotal),
      rate,
      lastAttendedDate,
      logs,
    };
  });

  const lowAttendanceDoctorsCount = participantSummaries.filter((p) => p.rate < 70).length;
  const inspectedLecture = allSessions.find((s) => s.id === selectedLectureId) || allSessions[0] || null;
  const inspectedParticipant =
    participantSummaries.find((p) => p.member.uid === selectedDoctorUid) || participantSummaries[0] || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Üst KPI Özeti */}
      <div className="grid-4">
        <article className="surface-card">
          <div className="metric-label">Toplam Kayıtlı Ders</div>
          <div className="metric-value mono-num">{allSessions.length}</div>
          <div className="page-header-subtitle" style={{ fontSize: "0.78rem" }}>
            {liveSession ? "1 Canlı Yoklama Açık" : "Aktif Yoklama Yok"}
          </div>
        </article>
        <article className="surface-card">
          <div className="metric-label">Ortalama Katılım Oranı</div>
          <div className="metric-value mono-num">%{averageAttendanceRate}</div>
          <div className="page-header-subtitle" style={{ fontSize: "0.78rem" }}>
            Tüm ders ve hekimlerin ortalaması
          </div>
        </article>
        <article className="surface-card">
          <div className="metric-label">Klinik Hekim Kadrosu</div>
          <div className="metric-value mono-num">{clinicRoster.length}</div>
          <div className="page-header-subtitle" style={{ fontSize: "0.78rem" }}>
            Aktif yoklama yükümlüsü
          </div>
        </article>
        <article className="surface-card">
          <div className="metric-label">&lt;%70 Katılım Uyarıları</div>
          <div className="metric-value mono-num">{lowAttendanceDoctorsCount}</div>
          <div className="page-header-subtitle" style={{ fontSize: "0.78rem" }}>
            Yakın takip gerektiren hekim
          </div>
        </article>
      </div>

      {/* Sekme Seçici */}
      <div
        className="surface-card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div className="mode-switcher" role="tablist" aria-label="Admin Yoklama Yönetim Sekmeleri">
          <button
            id="att-admin-tab-projector"
            type="button"
            className={`mode-btn ${dashboardTab === "projector" ? "active" : ""}`}
            onClick={() => setDashboardTab("projector")}
          >
            1. Ders Başlat &amp; Canlı Projektör
          </button>
          <button
            id="att-admin-tab-by-lecture"
            type="button"
            className={`mode-btn ${dashboardTab === "by_lecture" ? "active" : ""}`}
            onClick={() => setDashboardTab("by_lecture")}
          >
            2. Ders Bazlı Katılım Raporu
          </button>
          <button
            id="att-admin-tab-by-participant"
            type="button"
            className={`mode-btn ${dashboardTab === "by_participant" ? "active" : ""}`}
            onClick={() => setDashboardTab("by_participant")}
          >
            3. Asistan Bazlı Katılım Karnesi
          </button>
        </div>
      </div>

      {/* SEKME 1: DERS BAŞLATMA & CANLI PROJEKTÖR */}
      {dashboardTab === "projector" && (
        <div className="grid-2">
          <article className="surface-card" aria-labelledby="start-lecture-heading">
            <span className="sec-chip primary">Admin Yetkisi • Yoklama Başlatma</span>
            <h2 id="start-lecture-heading" style={{ marginTop: "0.5rem" }}>
              Yoklama Alınacak Dersi Başlat
            </h2>
            <p className="page-header-subtitle" style={{ marginBottom: "1rem" }}>
              Hekimler yalnızca Eğitim Sorumlusu (Admin) tarafından başlatılan aktif bir ders oturumu varken yoklama
              verebilir.
            </p>

            <form
              id="admin-start-lecture-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTitle.trim()) return;
                onStartNewSession(newTitle.trim(), newLecturer.trim(), newCategory, newDuration);
                setNewTitle("");
              }}
            >
              <div className="form-group">
                <label htmlFor="new-session-title" className="form-label">
                  Ders / Olgu Sunumu Başlığı
                </label>
                <input
                  id="new-session-title"
                  className="form-input"
                  placeholder="Örn: Pediatrik Diyabetik Ketoasidoz Sıvı ve İnsülin Yönetimi"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label htmlFor="new-session-lecturer" className="form-label">
                    Dersi Veren Öğretim Üyesi / Kıdemli
                  </label>
                  <input
                    id="new-session-lecturer"
                    className="form-input"
                    value={newLecturer}
                    onChange={(e) => setNewLecturer(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="new-session-category" className="form-label">
                    Eğitim Kategorisi
                  </label>
                  <select
                    id="new-session-category"
                    className="form-select"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    <option value="Sabah Vaka & Makale Saati">Sabah Vaka &amp; Makale Saati</option>
                    <option value="Çekirdek Eğitim Semineri">Çekirdek Eğitim Semineri</option>
                    <option value="Mortalite & Morbidite Konseyi">Mortalite &amp; Morbidite Konseyi</option>
                    <option value="Yatak Başı Klinik Pratik">Yatak Başı Klinik Pratik</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="new-session-duration" className="form-label">
                  Yoklama Açık Kalma Süresi (Dakika)
                </label>
                <input
                  id="new-session-duration"
                  type="number"
                  min={1}
                  max={180}
                  className="form-input mono-num"
                  value={newDuration}
                  onChange={(e) => setNewDuration(Math.max(1, Math.min(180, Number(e.target.value) || 15)))}
                  required
                />
              </div>

              <button id="create-attendance-session-btn" type="submit" className="btn btn-primary">
                Dersi Başlat ve Yoklama Kodunu Yansıt
              </button>
            </form>
          </article>

          <article className="surface-card" aria-labelledby="projector-heading">
            {liveSession ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <span className="sec-chip verified">Canlı Yoklama Açık • 15 sn Kriptografik Kod</span>
                  <button
                    id="end-attendance-session-btn"
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onEndLiveSession(liveSession.id)}
                  >
                    Yoklamayı Sonlandır
                  </button>
                </div>

                <h2 id="projector-heading" style={{ marginTop: "0.55rem" }}>
                  {liveSession.title}
                </h2>
                <p className="page-header-subtitle">
                  {liveSession.lecturer} • {liveSession.category} • Süre: {liveSession.durationMinutes} dk
                </p>

                <div
                  style={{
                    marginTop: "1rem",
                    padding: "1.25rem",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg-canvas)",
                    border: "2px dashed var(--clinical-primary)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                    PROJEKTÖR DİNAMİK DOĞRULAMA KODU (15 SANİYEDE BİR YENİLENİR)
                  </div>
                  <div
                    id="projector-hmac-code-display"
                    className="mono-num"
                    style={{
                      fontSize: "2.35rem",
                      fontWeight: 800,
                      letterSpacing: "0.24em",
                      color: "var(--clinical-primary)",
                      margin: "0.4rem 0",
                    }}
                  >
                    {liveSession.hmacSlotCode}
                  </div>
                  <div className="mono-num" style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                    Yeni koda kalan süre: <strong>{liveSession.secondsUntilRotation} sn</strong>
                  </div>
                </div>

                <div className="table-wrap" style={{ marginTop: "1rem" }}>
                  <table className="clinical-table">
                    <thead>
                      <tr>
                        <th>Hekim</th>
                        <th>Durum</th>
                        <th>Saat</th>
                        <th>Mazeret İşlemi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinicRoster.map((member) => {
                        const rec = liveSession.records[member.uid];
                        return (
                          <tr key={member.uid}>
                            <td>
                              <strong>
                                {member.title} {member.fullName}
                              </strong>{" "}
                              ({member.residencyYear}. Yıl)
                            </td>
                            <td>
                              {rec?.status === "present" ? (
                                <span className="sec-chip verified">Katıldı ✓</span>
                              ) : rec?.status === "excused" ? (
                                <span className="sec-chip warn">Mazeretli ({rec.excuseNote || "İzinli"})</span>
                              ) : (
                                <span className="sec-chip critical">Bekleniyor</span>
                              )}
                            </td>
                            <td className="mono-num">{rec?.verifiedAt || "—"}</td>
                            <td>
                              {!rec ? (
                                <div style={{ display: "flex", gap: "0.35rem" }}>
                                  <input
                                    type="text"
                                    className="form-input"
                                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.76rem", maxWidth: "130px" }}
                                    placeholder="Nöbet ertesi vb."
                                    value={excuseNotes[member.uid] || ""}
                                    onChange={(e) =>
                                      setExcuseNotes((prev) => ({ ...prev, [member.uid]: e.target.value }))
                                    }
                                  />
                                  <button
                                    id={`mark-excused-btn-${member.uid}`}
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() =>
                                      onMarkExcused(
                                        liveSession.id,
                                        member.uid,
                                        excuseNotes[member.uid] || "Nöbet Ertesi / İzinli"
                                      )
                                    }
                                  >
                                    Nöbet / İzin Mazereti Kaydet
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Kaydedildi</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div>
                <span className="sec-chip warn">Aktif Ders Yoklaması Yok</span>
                <h2 id="projector-heading" style={{ marginTop: "0.55rem" }}>
                  Yoklama Bekleniyor
                </h2>
                <p className="page-header-subtitle">
                  Soldaki formdan yeni bir ders başlattığınızda 15 saniyelik dinamik doğrulama kodu burada açılır ve
                  hekimlerin ekranında yoklama girişi aktifleşir.
                </p>
              </div>
            )}
          </article>
        </div>
      )}

      {/* SEKME 2: DERS BAZLI KATILIM LOG DASHBOARD'U */}
      {dashboardTab === "by_lecture" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <article className="surface-card">
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
                <h2>Ders Bazlı Katılım Özeti ve Logları</h2>
                <p className="page-header-subtitle">
                  Bir derse tıklayarak o dersteki katılımcı bazlı yoklama loglarını inceleyebilir veya CSV olarak
                  indirebilirsiniz.
                </p>
              </div>
              <button
                id="export-lecture-summary-csv-btn"
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  downloadCsv(
                    "pediatrist_ders_bazli_yoklama_ozeti.csv",
                    [
                      "DersID",
                      "Tarih",
                      "DersBasligi",
                      "Egitici",
                      "Kategori",
                      "Durum",
                      "Katilan",
                      "Mazeretli",
                      "Katilmayan",
                      "KatilimYuzdesi",
                    ],
                    allSessions.map((s) => {
                      const vals = Object.values(s.records);
                      const pres = vals.filter((v) => v.status === "present").length;
                      const exc = vals.filter((v) => v.status === "excused").length;
                      const abs = Math.max(0, totalDoctors - pres - exc);
                      const pct = Math.round(((pres + exc) / totalDoctors) * 100);
                      return [s.id, s.dateStr, s.title, s.lecturer, s.category, s.status, pres, exc, abs, `%${pct}`];
                    })
                  )
                }
              >
                Tüm Ders Yoklama Raporunu İndir (CSV / Excel)
              </button>
            </div>

            <div className="table-wrap">
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>Tarih / Saat</th>
                    <th>Ders Başlığı</th>
                    <th>Eğitici</th>
                    <th>Kategori</th>
                    <th>Durum</th>
                    <th>Katılan / Mazeretli / Toplam</th>
                    <th>Oran</th>
                    <th>Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {allSessions.map((sess) => {
                    const vals = Object.values(sess.records);
                    const pres = vals.filter((v) => v.status === "present").length;
                    const exc = vals.filter((v) => v.status === "excused").length;
                    const pct = Math.round(((pres + exc) / totalDoctors) * 100);
                    return (
                      <tr key={sess.id}>
                        <td className="mono-num">{sess.dateStr}</td>
                        <td>
                          <strong>{sess.title}</strong>
                        </td>
                        <td>{sess.lecturer}</td>
                        <td>{sess.category}</td>
                        <td>
                          <span className={`sec-chip ${sess.status === "live" ? "verified" : "primary"}`}>
                            {sess.status === "live" ? "Canlı" : "Tamamlandı"}
                          </span>
                        </td>
                        <td className="mono-num">
                          {pres} Katıldı • {exc} Mazeretli / {totalDoctors}
                        </td>
                        <td className="mono-num">
                          <strong>%{pct}</strong>
                        </td>
                        <td>
                          <button
                            id={`inspect-lecture-btn-${sess.id}`}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedLectureId(sess.id)}
                          >
                            Katılım Listesini Aç
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          {inspectedLecture && (
            <article className="surface-card">
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
                  <span className="sec-chip primary">Seçili Dersin Katılımcı Logları</span>
                  <h3 style={{ marginTop: "0.35rem" }}>
                    {inspectedLecture.title} ({inspectedLecture.dateStr})
                  </h3>
                </div>
                <button
                  id="export-single-lecture-csv-btn"
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    downloadCsv(
                      `ders_log_${inspectedLecture.id}.csv`,
                      ["Hekim", "KidemYili", "Durum", "DogrulamaSaati", "Yontem", "Aciklama"],
                      clinicRoster.map((m) => {
                        const r = inspectedLecture.records[m.uid];
                        return [
                          `${m.title} ${m.fullName}`,
                          m.residencyYear,
                          r?.status || "absent",
                          r?.verifiedAt || "—",
                          r?.method || "—",
                          r?.excuseNote || "",
                        ];
                      })
                    )
                  }
                >
                  Seçili Ders Yoklama Listesini İndir (CSV)
                </button>
              </div>

              <div className="table-wrap">
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>Hekim</th>
                      <th>Kıdem</th>
                      <th>Katılım Durumu</th>
                      <th>Doğrulama Saati</th>
                      <th>Doğrulama Yöntemi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinicRoster.map((m) => {
                      const r = inspectedLecture.records[m.uid];
                      return (
                        <tr key={m.uid}>
                          <td>
                            <strong>
                              {m.title} {m.fullName}
                            </strong>
                          </td>
                          <td className="mono-num">{m.residencyYear}. Yıl</td>
                          <td>
                            {r?.status === "present" ? (
                              <span className="sec-chip verified">Katıldı ✓</span>
                            ) : r?.status === "excused" ? (
                              <span className="sec-chip warn">Mazeretli ({r.excuseNote || "İzinli"})</span>
                            ) : (
                              <span className="sec-chip critical">Katılmadı</span>
                            )}
                          </td>
                          <td className="mono-num">{r?.verifiedAt || "—"}</td>
                          <td className="mono-num">{r?.method || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          )}
        </div>
      )}

      {/* SEKME 3: KATILIMCI (HEKİM) BAZLI KATILIM LOG DASHBOARD'U */}
      {dashboardTab === "by_participant" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <article className="surface-card">
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
                <h2>Asistan Hekim Bazlı Katılım Takip Karnesi</h2>
                <p className="page-header-subtitle">
                  Her asistan hekimin tüm eğitim oturumlarındaki katılım istatistiklerini ve bireysel yoklama geçmişini
                  takip edin.
                </p>
              </div>
              <button
                id="export-participant-summary-csv-btn"
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  downloadCsv(
                    "pediatrist_katilimci_bazli_yoklama_ozeti.csv",
                    [
                      "Hekim",
                      "KidemYili",
                      "KatildigiDers",
                      "MazeretliDers",
                      "KatilmadigiDers",
                      "ToplamDers",
                      "KatilimYuzdesi",
                      "SonKatilim",
                    ],
                    participantSummaries.map((p) => [
                      `${p.member.title} ${p.member.fullName}`,
                      p.member.residencyYear,
                      p.presentCount,
                      p.excusedCount,
                      p.absentCount,
                      allSessions.length,
                      `%${p.rate}`,
                      p.lastAttendedDate,
                    ])
                  )
                }
              >
                Asistan Katılım Özetini İndir (CSV / Excel)
              </button>
            </div>

            <div className="table-wrap">
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>Hekim</th>
                    <th>Kıdem</th>
                    <th>Katıldığı</th>
                    <th>Mazeretli</th>
                    <th>Katılmadığı</th>
                    <th>Katılım Oranı</th>
                    <th>Son Katılım</th>
                    <th>Bireysel Log</th>
                  </tr>
                </thead>
                <tbody>
                  {participantSummaries.map((p) => (
                    <tr key={p.member.uid}>
                      <td>
                        <strong>
                          {p.member.title} {p.member.fullName}
                        </strong>
                      </td>
                      <td className="mono-num">{p.member.residencyYear}. Yıl</td>
                      <td className="mono-num">
                        {p.presentCount} / {allSessions.length}
                      </td>
                      <td className="mono-num">{p.excusedCount}</td>
                      <td className="mono-num">{p.absentCount}</td>
                      <td>
                        <span className={`sec-chip mono-num ${p.rate >= 70 ? "verified" : "critical"}`}>%{p.rate}</span>
                      </td>
                      <td className="mono-num">{p.lastAttendedDate}</td>
                      <td>
                        <button
                          id={`inspect-participant-btn-${p.member.uid}`}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedDoctorUid(p.member.uid)}
                        >
                          Asistan Katılım Karnesi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          {inspectedParticipant && (
            <article className="surface-card">
              <span className="sec-chip primary">Bireysel Ders Katılım Logları</span>
              <h3 style={{ marginTop: "0.35rem", marginBottom: "0.75rem" }}>
                {inspectedParticipant.member.title} {inspectedParticipant.member.fullName} — Tüm Ders Kayıtları
              </h3>
              <div className="table-wrap">
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Ders Başlığı</th>
                      <th>Eğitici</th>
                      <th>Kategori</th>
                      <th>Durum</th>
                      <th>Doğrulama Saati</th>
                      <th>Yöntem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectedParticipant.logs.map((log) => (
                      <tr key={log.sessionId}>
                        <td className="mono-num">{log.dateStr}</td>
                        <td>
                          <strong>{log.sessionTitle}</strong>
                        </td>
                        <td>{log.lecturer}</td>
                        <td>{log.category}</td>
                        <td>
                          {log.status === "present" ? (
                            <span className="sec-chip verified">Katıldı ✓</span>
                          ) : log.status === "excused" ? (
                            <span className="sec-chip warn">Mazeretli ({log.excuseNote || "İzinli"})</span>
                          ) : (
                            <span className="sec-chip critical">Katılmadı</span>
                          )}
                        </td>
                        <td className="mono-num">{log.verifiedAt}</td>
                        <td className="mono-num">{log.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
