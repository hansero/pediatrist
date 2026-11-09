"use client";

import React, { useEffect, useState } from "react";
import {
  AdminLiveAttendanceProjector,
  AttendanceSessionItem,
  ClinicRosterMember,
} from "@/components/attendance/AdminLiveAttendanceProjector";
import { DoctorRealTimeCheckIn } from "@/components/attendance/DoctorRealTimeCheckIn";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";
import { ClinicMemberSession } from "@/components/security/SessionGuard";
import {
  startLectureSession,
  endLectureSession,
  verifyRealTimeAttendance,
  markAttendanceExcused,
  invokeWithFallback,
  getOrCreateClientDeviceSecret,
} from "@/lib/firebase/callables";

const CLINIC_ROSTER: ClinicRosterMember[] = [
  {
    uid: "uid_admin_1",
    fullName: "Dr. Selim Kaya",
    title: "Prof. Dr.",
    residencyYear: 4,
    hasBoundDevice: true,
  },
  {
    uid: "uid_user_1",
    fullName: "Dr. Elif Demir",
    title: "Asistan Dr.",
    residencyYear: 2,
    hasBoundDevice: true,
  },
  {
    uid: "uid_user_2",
    fullName: "Dr. Burak Şahin",
    title: "Asistan Dr.",
    residencyYear: 3,
    hasBoundDevice: true,
  },
];

const INITIAL_SESSIONS: AttendanceSessionItem[] = [
  {
    id: "att_session_nov05",
    title: "Sabah Olgu Sunumu: Ateşli Süt Çocuğunda Kawasaki ve MIS-C Ayırıcı Tanısı",
    lecturer: "Prof. Dr. Selim Kaya",
    category: "Sabah Vaka & Makale Saati",
    dateStr: "2026-11-05 08:30",
    durationMinutes: 15,
    status: "live",
    hmacSlotCode: "K9P4X2",
    secondsUntilRotation: 15,
    records: {
      uid_admin_1: {
        uid: "uid_admin_1",
        fullName: "Dr. Selim Kaya",
        title: "Prof. Dr.",
        residencyYear: 4,
        verifiedAt: "08:31:04",
        method: "qr+webauthn",
        status: "present",
      },
    },
  },
  {
    id: "att_session_nov03",
    title: "Yenidoğan Resüsitasyonu (NRP) Güncel Algoritma ve Vaka Tartışması",
    lecturer: "Doç. Dr. Ayşe Aksoy",
    category: "Çekirdek Eğitim Semineri",
    dateStr: "2026-11-03 09:00",
    durationMinutes: 20,
    status: "closed",
    hmacSlotCode: "------",
    secondsUntilRotation: 0,
    records: {
      uid_admin_1: {
        uid: "uid_admin_1",
        fullName: "Dr. Selim Kaya",
        title: "Prof. Dr.",
        residencyYear: 4,
        verifiedAt: "09:01:10",
        method: "qr+webauthn",
        status: "present",
      },
      uid_user_1: {
        uid: "uid_user_1",
        fullName: "Dr. Elif Demir",
        title: "Asistan Dr.",
        residencyYear: 2,
        verifiedAt: "09:02:18",
        method: "qr+webauthn",
        status: "present",
      },
      uid_user_2: {
        uid: "uid_user_2",
        fullName: "Dr. Burak Şahin",
        title: "Asistan Dr.",
        residencyYear: 3,
        verifiedAt: "09:05:00",
        method: "admin_excused",
        status: "excused",
        excuseNote: "Yenidoğan Yoğun Bakım Nöbet Ertesi",
      },
    },
  },
];

function generateDynamicSlotCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const FALLBACK_USER_SESSION: ClinicMemberSession = {
  uid: "uid_user_1",
  email: "elif.demir@pediatri.edu.tr",
  fullName: "Dr. Elif Demir",
  title: "Asistan Dr.",
  residencyYear: 2,
  role: "user",
  status: "active",
  mfaVerified: true,
  appCheckVerified: true,
  hasBoundDevice: true,
};

export default function AttendancePage() {
  const { session: ctxSession } = useClinicSession();
  const activeSession = ctxSession ?? FALLBACK_USER_SESSION;
  const isAdmin = activeSession.role === "admin";

  const [sessions, setSessions] = useState<AttendanceSessionItem[]>(INITIAL_SESSIONS);
  const liveSession = sessions.find((s) => s.status === "live") || null;

  // 15 Saniyelik Dinamik Kod Rotasyonu (yalnızca canlı ders varken)
  useEffect(() => {
    const timer = setInterval(() => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.status !== "live") return s;
          if (s.secondsUntilRotation <= 1) {
            return {
              ...s,
              hmacSlotCode: generateDynamicSlotCode(),
              secondsUntilRotation: 15,
            };
          }
          return {
            ...s,
            secondsUntilRotation: s.secondsUntilRotation - 1,
          };
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerifyAttendance = (inputCode: string, useRegisteredDevice: boolean, webAuthnOk: boolean) => {
    if (!liveSession) {
      return {
        ok: false,
        message: "Şu anda aktif bir ders yoklaması bulunmuyor.",
      };
    }

    if (!useRegisteredDevice) {
      return {
        ok: false,
        message:
          "Bu cihaz hesabınıza kayıtlı birincil cihaz değil. Cihaz değişikliği için Eğitim Sorumlusuna (Admin) başvurun.",
      };
    }

    if (inputCode.trim().toUpperCase() !== liveSession.hmacSlotCode) {
      return {
        ok: false,
        message:
          "Girilen yoklama kodu geçersiz veya 15 saniyelik süresi doldu. Lütfen projektördeki güncel kodu girin.",
      };
    }

    const nowTime = new Date().toTimeString().split(" ")[0];
    void invokeWithFallback(
      () =>
        verifyRealTimeAttendance({
          sessionId: liveSession.id,
          dynamicCode: inputCode.trim().toUpperCase(),
          clientDeviceSecret: getOrCreateClientDeviceSecret(),
          webAuthnVerified: webAuthnOk,
        }),
      () => ({
        ok: true,
        status: "present" as const,
        verifiedAt: nowTime,
        fullName: activeSession.fullName,
        residencyYear: activeSession.residencyYear,
      })
    );

    setSessions((prev) =>
      prev.map((s) =>
        s.id === liveSession.id
          ? {
              ...s,
              records: {
                ...s.records,
                [activeSession.uid]: {
                  uid: activeSession.uid,
                  fullName: activeSession.fullName,
                  title: activeSession.title,
                  residencyYear: activeSession.residencyYear,
                  verifiedAt: nowTime,
                  method: webAuthnOk ? "qr+webauthn" : "qr+device_bound",
                  status: "present",
                },
              },
            }
          : s
      )
    );

    return {
      ok: true,
      message: `Yoklama başarıyla doğrulandı (${activeSession.title} ${activeSession.fullName} • Saat: ${nowTime}).`,
    };
  };

  const personalAttendanceHistory = sessions.map((s) => {
    const rec = s.records[activeSession.uid];
    return {
      sessionId: s.id,
      title: s.title,
      lecturer: s.lecturer,
      category: s.category,
      dateStr: s.dateStr,
      status: rec?.status ?? ("absent" as const),
      verifiedAt: rec?.verifiedAt ?? "—",
    };
  });

  return (
    <section aria-labelledby="attendance-page-heading">
      <div className="page-header">
        <div>
          <span className="sec-chip primary">Modül 3 • /attendance</span>
          <h1 id="attendance-page-heading" style={{ marginTop: "0.45rem" }}>
            Derslere Katılım Kontrolü
          </h1>
          <p className="page-header-subtitle">
            {isAdmin
              ? "Yoklama alınacak dersi başlatın, canlı projektör kodunu yansıtın ve ders/asistan bazlı katılım karnelerini takip edin."
              : "Eğitim Sorumlusu (Prof. Dr.) tarafından başlatılan aktif derse kişisel telefonunuzla yoklama verin ve katılım geçmişinizi takip edin."}
          </p>
        </div>
      </div>

      {isAdmin ? (
        <AdminLiveAttendanceProjector
          liveSession={liveSession}
          allSessions={sessions}
          clinicRoster={CLINIC_ROSTER}
          onStartNewSession={(title, lecturer, category, durationMinutes) => {
            const newId = `att_${Date.now()}`;
            void invokeWithFallback(
              () => startLectureSession({ title, lecturer, category, durationMinutes }),
              () => ({
                ok: true,
                sessionId: newId,
                status: "live" as const,
                durationMinutes,
                expiresAtMs: Date.now() + durationMinutes * 60_000,
              })
            );
            const newSess: AttendanceSessionItem = {
              id: newId,
              title,
              lecturer,
              category,
              dateStr: new Date().toLocaleString("tr-TR"),
              durationMinutes,
              status: "live",
              hmacSlotCode: generateDynamicSlotCode(),
              secondsUntilRotation: 15,
              records: {},
            };
            // Varsa önceki canlı oturumu kapat, yenisini canlı başlat
            setSessions((prev) => [
              newSess,
              ...prev.map((s) => (s.status === "live" ? { ...s, status: "closed" as const } : s)),
            ]);
          }}
          onEndLiveSession={(sessionId) => {
            void invokeWithFallback(
              () => endLectureSession({ sessionId }),
              () => ({ ok: true, sessionId, status: "closed" as const })
            );
            setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, status: "closed" as const } : s)));
          }}
          onMarkExcused={(sessionId, uid, excuseNote) => {
            const member = CLINIC_ROSTER.find((m) => m.uid === uid);
            if (!member) return;
            void invokeWithFallback(
              () => markAttendanceExcused({ sessionId, targetUid: uid, excuseNote }),
              () => ({ ok: true, sessionId, targetUid: uid, status: "excused" as const })
            );
            setSessions((prev) =>
              prev.map((s) =>
                s.id === sessionId
                  ? {
                      ...s,
                      records: {
                        ...s.records,
                        [uid]: {
                          uid,
                          fullName: member.fullName,
                          title: member.title,
                          residencyYear: member.residencyYear,
                          verifiedAt: new Date().toTimeString().split(" ")[0],
                          method: "admin_excused",
                          status: "excused",
                          excuseNote,
                        },
                      },
                    }
                  : s
              )
            );
          }}
        />
      ) : (
        <DoctorRealTimeCheckIn
          session={activeSession}
          liveSession={liveSession}
          personalAttendanceHistory={personalAttendanceHistory}
          onVerifyAttendance={handleVerifyAttendance}
        />
      )}
    </section>
  );
}
