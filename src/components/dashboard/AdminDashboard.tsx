"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useLiveLecture } from "@/lib/attendance/live";
import { useReportQuery } from "@/lib/attendance/reports";
import {
  adminNextStep,
  ATTENDANCE_KPI_DAYS,
  fetchPendingMemberCount,
  fetchQuizParticipation,
  fetchRecentAttendanceStats,
  type AdminStep,
} from "@/lib/dashboard";
import { usePublishedQuiz } from "@/lib/quiz/doctor";
import { clock, dateTime, Kpi, NextStepCard, percent, useMinuteClock } from "./parts";

function stepCard(step: AdminStep) {
  switch (step.kind) {
    case "lecture":
      return {
        title: `Canlı ders sürüyor: ${step.lecture.title}`,
        description: `${step.lecture.presentCount} / ${step.lecture.expectedCount} hekim katıldı · ${clock(step.lecture.endsAtMs)}'e kadar açık.`,
        action: { href: "/attendance", label: "Dersi yönet" },
      };
    case "pending-members":
      return {
        title: `${step.count} başvuru onay bekliyor`,
        description: "Onaylanan üye kendi kıdemine yönelik içeriğe hemen erişir.",
        action: { href: "/admin", label: "Başvuruları incele" },
      };
    case "quiz":
      return {
        title: `Yayında sınav: ${step.quiz.title}`,
        description: step.quiz.closesAtMs
          ? `${dateTime(step.quiz.closesAtMs)} tarihinde kendiliğinden kapanır.`
          : "Siz kapatana kadar açık kalır.",
        action: { href: "/quizzes", label: "Sınavı izle" },
      };
    case "none":
      return {
        title: "Bekleyen iş yok",
        description: "Süren ders, onay bekleyen başvuru veya yayında sınav yok.",
        secondary: [
          { href: "/attendance", label: "Ders başlat" },
          { href: "/quizzes", label: "Sınav hazırla" },
          { href: "/materials", label: "Materyal yükle" },
        ],
      };
  }
}

/** Eğitim sorumlusu ana sayfası (F7.3): sıradaki tek iş ve klinik göstergeleri (sunucu sayımları). */
export function AdminDashboard() {
  const now = useMinuteClock();
  const [nonce, setNonce] = useState(0);

  const lecture = useLiveLecture();
  const quiz = usePublishedQuiz();
  const pending = useReportQuery(fetchPendingMemberCount, [nonce]);
  const recent = useReportQuery(() => fetchRecentAttendanceStats(Date.now()), [nonce]);
  const quizId = quiz.data?.id ?? null;
  const participation = useReportQuery(quizId ? () => fetchQuizParticipation(quizId) : null, [quizId, nonce]);

  const sources = [lecture, quiz, pending];
  const loading = sources.some((s) => s.status === "loading");
  const errors = [...new Set(sources.map((s) => s.error).filter(Boolean))];
  const step = adminNextStep({
    lecture: lecture.data,
    pendingMembers: pending.data,
    quiz: quiz.data,
    nowMs: now,
  });
  const r = recent.data;
  const p = participation.data;

  return (
    <div className="attendance-admin">
      {errors.length > 0 && <Alert tone="critical">{errors.join(" ")}</Alert>}
      <NextStepCard {...stepCard(step)} loading={loading && errors.length === 0} />

      <section aria-labelledby="kpi-heading" className="auth-stack">
        <div className="ui-card-header">
          <h2 id="kpi-heading">Klinik göstergeleri</h2>
          <Button variant="secondary" size="sm" onClick={() => setNonce((n) => n + 1)}>
            Göstergeleri yenile
          </Button>
        </div>
        <dl className="grid-3 kpi-grid">
          <Kpi
            label="Onay bekleyen başvuru"
            state={pending}
            value={pending.data ?? "—"}
            foot={pending.data ? "Üyeler ve güvenlik sayfasında" : "Onay bekleyen başvuru yok."}
          />
          <Kpi
            label={`Son ${ATTENDANCE_KPI_DAYS} gün katılım`}
            state={recent}
            value={percent(r?.rate ?? null)}
            foot={
              r && r.lectures > 0
                ? `${r.lectures} ders · ${r.present} katılım, ${r.absent} katılmama (mazeretliler hariç)`
                : `Son ${ATTENDANCE_KPI_DAYS} günde kapanmış ders yok.`
            }
          />
          <Kpi
            label="Yayındaki sınav"
            state={quizId ? participation : quiz}
            value={quizId && p ? `${p.submitted} / ${p.activeDoctors}` : "—"}
            foot={
              quizId && p
                ? `hekim teslim etti${p.inProgress ? ` · ${p.inProgress} hekim çözüyor` : ""}`
                : "Yayında sınav yok."
            }
          />
        </dl>
      </section>
    </div>
  );
}
