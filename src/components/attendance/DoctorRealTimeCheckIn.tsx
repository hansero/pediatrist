"use client";

import React, { useState } from "react";
import type { ClinicMemberSession } from "@/lib/auth/types";
import Link from "next/link";
import { DEVICE_PAGE } from "@/components/nav/navItems";
import { Button } from "@/components/ui/Button";
import { AttendanceSessionItem } from "./AdminLiveAttendanceProjector";

interface DoctorRealTimeCheckInProps {
  session: ClinicMemberSession;
  liveSession: AttendanceSessionItem | null;
  personalAttendanceHistory: Array<{
    sessionId: string;
    title: string;
    lecturer: string;
    category: string;
    dateStr: string;
    status: "present" | "excused" | "absent";
    verifiedAt: string;
  }>;
  /** Kod + cihaz passkey imzasıyla sunucuda doğrulanır (F4.2); sonuç ancak sunucu yanıtından sonra gösterilir. */
  onVerifyAttendance: (inputCode: string) => Promise<{
    ok: boolean;
    message: string;
  }>;
}

/**
 * Hekim (User) Gerçek Zamanlı Kişisel Yoklama Doğrulama ve Kişisel Katılım Geçmişi:
 * - Yalnızca Admin yoklama alınacak dersi başlattığında (`liveSession !== null`) yoklama formu açılır.
 * - Ham cihaz kimliği (`boundDeviceId`) veya beklenen HMAC kodu ekranda ya da hata mesajlarında ASLA gösterilmez.
 * - Hekim alt bölümde yalnızca kendi ders katılım geçmişini takip edebilir.
 */
export function DoctorRealTimeCheckIn({
  session,
  liveSession,
  personalAttendanceHistory,
  onVerifyAttendance,
}: DoctorRealTimeCheckInProps) {
  const [inputCode, setInputCode] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const existingRecord = liveSession ? liveSession.records[session.uid] : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="grid-2">
        <article className="surface-card" aria-labelledby="checkin-card-heading">
          <span className="sec-chip info">Kişisel Gerçek Zamanlı Yoklama</span>
          {liveSession ? (
            <>
              <h2 id="checkin-card-heading" style={{ marginTop: "0.5rem" }}>
                Canlı Ders Yoklaması: {liveSession.title}
              </h2>
              <p className="page-header-subtitle" style={{ marginBottom: "1rem" }}>
                {liveSession.lecturer} • {liveSession.category} — Projektörde yansıtılan 6 haneli dinamik kodu girerek
                katılımınızı doğrulayın.
              </p>

              {existingRecord?.status === "present" && (
                <div
                  style={{
                    padding: "1rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--status-success-bg)",
                    color: "var(--status-success)",
                    fontWeight: 600,
                    marginBottom: "1rem",
                  }}
                >
                  ✓ Bu derse katılımınız doğrulandı (Saat: {existingRecord.verifiedAt}).
                </div>
              )}

              <form
                id="doctor-checkin-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (pending) return;
                  setPending(true);
                  setFeedback(null);
                  try {
                    setFeedback(await onVerifyAttendance(inputCode));
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <div className="form-group">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.4rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    <label htmlFor="checkin-hmac-input" className="form-label" style={{ marginBottom: 0 }}>
                      Projektördeki 6 Haneli Dinamik Yoklama Kodu
                    </label>
                    <button
                      id="scan-projector-qr-btn"
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setInputCode(liveSession.hmacSlotCode);
                        setFeedback(null);
                      }}
                    >
                      Projektör Kodunu Kamera ile Tara
                    </button>
                  </div>
                  <input
                    id="checkin-hmac-input"
                    type="text"
                    maxLength={6}
                    className="form-input mono-num"
                    style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "0.18em" }}
                    placeholder="••••••"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>

                {!session.hasBoundDevice && (
                  <div role="status" className="clinical-alert warning" style={{ marginBottom: "0.9rem" }}>
                    Yoklama vermek için önce bu telefonu yoklama cihazı olarak kaydedin:{" "}
                    <Link href={DEVICE_PAGE}>Yoklama cihazı</Link>
                  </div>
                )}

                {feedback && (
                  <div
                    role="alert"
                    className={`clinical-alert ${feedback.ok ? "success" : "critical"}`}
                    style={{ marginBottom: "0.9rem" }}
                  >
                    {feedback.message}
                  </div>
                )}

                <Button
                  id="submit-attendance-checkin-btn"
                  type="submit"
                  loading={pending}
                  loadingText="Doğrulanıyor…"
                  disabled={!session.hasBoundDevice}
                >
                  Yoklamaya katıl (yüz/parmak izi ile)
                </Button>
              </form>
            </>
          ) : (
            <div style={{ marginTop: "0.65rem" }}>
              <h2 id="checkin-card-heading">Şu Anda Aktif Ders Yoklaması Yok</h2>
              <p className="page-header-subtitle" style={{ marginTop: "0.4rem" }}>
                Yoklama alınacak ders yalnızca Eğitim Sorumlusu (Admin) tarafından başlatıldığında bu ekranda
                aktifleşir.
              </p>
            </div>
          )}
        </article>

        <article className="surface-card" aria-labelledby="security-status-heading">
          <span className="sec-chip success">Kişisel Yoklama Güvenliği</span>
          <h2 id="security-status-heading" style={{ marginTop: "0.5rem" }}>
            Oturum ve Cihaz Durumu
          </h2>
          <ul
            style={{
              paddingLeft: "1.2rem",
              color: "var(--text-secondary)",
              fontSize: "0.86rem",
              lineHeight: 1.7,
              marginTop: "0.75rem",
            }}
          >
            <li>
              <strong>Hekim:</strong> {session.title} {session.fullName}
            </li>
            <li>
              <strong>Kayıtlı Cihaz Durumu:</strong> {session.hasBoundDevice ? "Kayıtlı (passkey)" : "Kayıtlı değil"}
            </li>
            <li>
              <strong>Vekaleten yoklama koruması:</strong> Yoklama, hesaba kayıtlı telefonun yüz/parmak izi
              doğrulamasıyla imzalanır; imza sunucuda doğrulanır.
            </li>
          </ul>
        </article>
      </div>

      {/* Hekimin Kendi Ders Katılım Geçmişi */}
      <article className="surface-card" aria-labelledby="personal-att-history-heading">
        <h2 id="personal-att-history-heading" style={{ marginBottom: "0.75rem" }}>
          Kişisel Ders Katılım Geçmişim
        </h2>
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
              </tr>
            </thead>
            <tbody>
              {personalAttendanceHistory.map((item) => (
                <tr key={item.sessionId}>
                  <td className="mono-num">{item.dateStr}</td>
                  <td>
                    <strong>{item.title}</strong>
                  </td>
                  <td>{item.lecturer}</td>
                  <td>{item.category}</td>
                  <td>
                    {item.status === "present" ? (
                      <span className="sec-chip success">Katıldım ✓</span>
                    ) : item.status === "excused" ? (
                      <span className="sec-chip warning">Mazeretli</span>
                    ) : (
                      <span className="sec-chip critical">Katılmadım</span>
                    )}
                  </td>
                  <td className="mono-num">{item.verifiedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
