"use client";

import { ATTENDANCE_WARN_RATE, isAttendanceEligible } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import type { ClinicMemberSession } from "@/lib/auth/types";
import { isLectureOpen, useLiveLecture, useMyRecord } from "@/lib/attendance/live";
import { isBelowThreshold, useReportQuery } from "@/lib/attendance/reports";
import {
  doctorNextStep,
  fetchCompletedMaterialIds,
  fetchMyAttendanceCounts,
  mandatoryFor,
  type DoctorStep,
} from "@/lib/dashboard";
import { MATERIAL_PARAM, usePublishedMaterials } from "@/lib/materials/doctor";
import { useMyAttempts, usePublishedQuiz } from "@/lib/quiz/doctor";
import { summarizeScores } from "@/lib/quiz/analytics";
import { clock, dateTime, Kpi, NextStepCard, percent, useMinuteClock } from "./parts";

function stepCard(step: DoctorStep) {
  switch (step.kind) {
    case "lecture":
      return {
        title: `Canlı ders: ${step.lecture.title}`,
        description: `${step.lecture.lecturer} · ${clock(step.lecture.endsAtMs)}'e kadar açık. Projektördeki kodu girerek katılın.`,
        action: { href: "/attendance", label: "Yoklamaya katıl" },
      };
    case "quiz-resume":
      return {
        title: `Sınavınız sürüyor: ${step.attempt.quizTitle}`,
        description: `Süreniz ${step.attempt.deadlineMs ? clock(step.attempt.deadlineMs) : "—"}'de dolar; süre dolunca kayıtlı yanıtlarınız teslim edilir.`,
        action: { href: "/quizzes", label: "Sınava devam et" },
      };
    case "quiz-start":
      return {
        title: `Yayında sınav: ${step.quiz.title}`,
        description: `${step.quiz.questionCount} soru · ${step.quiz.durationMinutes} dakika${
          step.quiz.closesAtMs ? ` · ${dateTime(step.quiz.closesAtMs)} tarihinde kapanır` : ""
        }. Başladığınızda süre işlemeye başlar.`,
        action: { href: "/quizzes", label: "Sınava git" },
      };
    case "material":
      return {
        title: `Zorunlu materyal: ${step.material.title}`,
        description:
          step.remaining > 1
            ? `Kıdeminize yönelik ${step.remaining} zorunlu materyali henüz tamamlamadınız.`
            : "Kıdeminize yönelik son tamamlanmamış zorunlu materyal.",
        action: {
          href: `/materials?${MATERIAL_PARAM}=${encodeURIComponent(step.material.id)}`,
          label: "Materyali aç",
        },
      };
    case "none":
      return {
        title: "Bekleyen işiniz yok",
        description: "Canlı ders, yayında sınav veya tamamlanmamış zorunlu materyal olduğunda burada görünür.",
      };
  }
}

/** Hekim ana sayfası (F7.3): sıradaki tek iş ve kişisel göstergeler. */
export function DoctorDashboard({ session }: { session: ClinicMemberSession }) {
  const now = useMinuteClock();
  // D24: yoklama yalnızca 1.–4. yıl asistanlar içindir; uzman/öğretim üyesinde canlı ders adımı ve katılım göstergesi yok.
  const attends = isAttendanceEligible(session);
  const lecture = useLiveLecture();
  const openLecture = attends && isLectureOpen(lecture.data, now) ? lecture.data : null;
  const myRecord = useMyRecord(openLecture?.id ?? null, session.uid);
  const quiz = usePublishedQuiz();
  const attempts = useMyAttempts(session.uid);
  const materials = usePublishedMaterials();

  const mandatory = mandatoryFor(materials.data ?? [], session);
  const mandatoryKey = mandatory.map((m) => m.id).join(",");
  const completed = useReportQuery(
    materials.status === "ready"
      ? () =>
          fetchCompletedMaterialIds(
            session.uid,
            mandatory.map((m) => m.id)
          )
      : null,
    [session.uid, mandatoryKey, materials.status]
  );
  const attendance = useReportQuery(attends ? () => fetchMyAttendanceCounts(session.uid) : null, [
    session.uid,
    attends,
  ]);

  const sources = [lecture, myRecord, quiz, attempts, materials, completed];
  const loading = sources.some((s) => s.status === "loading");
  const errors = [...new Set(sources.map((s) => s.error).filter(Boolean))];

  const pendingMaterials = completed.data ? mandatory.filter((m) => !completed.data.has(m.id)) : [];
  const step = doctorNextStep({
    lecture: openLecture,
    myRecordStatus: myRecord.data?.status ?? null,
    quiz: quiz.data,
    attempts: attempts.data ?? [],
    pendingMaterials,
    nowMs: now,
  });

  const scored = (attempts.data ?? []).filter((a) => a.status === "submitted" && a.score !== null);
  const scores = summarizeScores(scored.map((a) => ({ score: a.score ?? 0, submittedAtMs: a.submittedAtMs ?? 0 })));
  const att = attendance.data;

  return (
    <div className="attendance-admin">
      {errors.length > 0 && <Alert tone="critical">{errors.join(" ")}</Alert>}
      {openLecture && myRecord.data && (
        <Alert tone="success">
          {openLecture.title} dersine katılımınız kaydedildi
          {myRecord.data.status === "excused" ? " (mazeretli)" : ""}.
        </Alert>
      )}
      <NextStepCard {...stepCard(step)} loading={loading && errors.length === 0} />

      <section aria-labelledby="kpi-heading" className="auth-stack">
        <h2 id="kpi-heading">Göstergelerim</h2>
        <dl className="grid-3 kpi-grid">
          <Kpi
            label="Sınav ortalaması"
            state={attempts}
            value={scores.average ?? "—"}
            foot={
              scores.count
                ? `${scores.count} puanlanmış sınav · son puan ${scores.latest}`
                : "Henüz puanlanmış sınavınız yok."
            }
          />
          <Kpi
            label="Zorunlu materyal"
            state={materials.status === "ready" ? completed : materials}
            value={mandatory.length ? `${mandatory.length - pendingMaterials.length} / ${mandatory.length}` : "—"}
            foot={mandatory.length ? "tamamlandı" : "Kıdeminize yönelik zorunlu materyal yok."}
          />
          {attends && (
            <Kpi
              label="Derse katılım"
              state={attendance}
              value={percent(att?.rate ?? null)}
              foot={
                att && att.present + att.absent > 0
                  ? `${att.present} derse katıldınız · ${att.absent} derse katılmadınız${att.excused ? ` · ${att.excused} mazeretli` : ""}`
                  : "Henüz kapanmış ders kaydınız yok."
              }
              warning={
                att && isBelowThreshold(att.rate)
                  ? `Katılımınız %${Math.round(ATTENDANCE_WARN_RATE * 100)} eşiğinin altında.`
                  : undefined
              }
            />
          )}
        </dl>
      </section>
    </div>
  );
}
