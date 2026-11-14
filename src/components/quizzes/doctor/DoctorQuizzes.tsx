"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CallableResponse } from "@shared/schemas";
import { Alert } from "@/components/ui/Alert";
import { ListLimitNotice } from "@/components/ui/ListLimitNotice";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { ClinicMemberSession } from "@/lib/auth/types";
import { getAttemptReport, startQuizAttempt, submitQuizAttempt } from "@/lib/firebase/callables";
import { REVEAL_POLICY_LABEL } from "@/lib/quiz/admin";
import { resumableAttempt, useMyAttempts, usePublishedQuiz, type MyAttempt } from "@/lib/quiz/doctor";
import { QuizExam, type SubmitResponse } from "../exam/QuizExam";
import { AttemptReport, type ReportData } from "../report/AttemptReport";
import { ScoreTrend } from "../ScoreTrend";
import { summarizeScores } from "@/lib/quiz/analytics";
import { withClockOffset } from "@/lib/clock";
import { toAppError } from "@/lib/errors";

type StartResponse = CallableResponse<"startQuizAttempt">;
const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

type View =
  | { kind: "panel" }
  | { kind: "exam"; quizId: string; start: StartResponse; clockOffsetMs: number }
  | { kind: "report"; title: string; report: ReportData };

/**
 * Hekim sınav sayfası (F5.3). Durumlar: yayında sınav yok / başlanmadı / devam ediyor / teslim edildi.
 * Devam eden girişim varsa sayfa açılınca sınava kendiliğinden dönülür (yenileme sonrası kaldığı yerden).
 */
export function DoctorQuizzes({ session }: { session: ClinicMemberSession }) {
  const published = usePublishedQuiz();
  const attempts = useMyAttempts(session.uid);
  const [view, setView] = useState<View>({ kind: "panel" });
  const leftManually = useRef(false);
  const autoResumed = useRef(false);

  const begin = useAsyncAction(async (quizId: string) => {
    // Saat farkı: sunucu saati − istek ortasındaki cihaz saati (cihaz saati yanlışsa geri sayım düzelir).
    const { result: start, offsetMs: clockOffsetMs } = await withClockOffset(() => startQuizAttempt({ quizId }));
    if (start.resumed && start.deadlineMs <= start.serverNowMs) {
      // Süresi (sunucu saatine göre) dolmuş girişim: soru ekranı açılmadan kaydedilmiş yanıtlarla teslim edilir
      // (F13.3). Sınav ekranı da açılır açılmaz aynısını yapardı; ekran bir an görünüp kaybolmaz.
      try {
        const result = await submitQuizAttempt({ quizId, responses: start.savedResponses, tabSwitchCount: 0 });
        setView({ kind: "report", title: start.quizTitle, report: { ...result, timedOut: true } });
      } catch (err) {
        // Zamanlayıcı az önce teslim ettiyse (zaten teslim edildi): panel kendi kaydını dinlediği için puanı gösterir.
        if (toAppError(err).code !== "failed-precondition") throw err;
      }
      return start;
    }
    setView({ kind: "exam", quizId, start, clockOffsetMs });
    return start;
  });

  const openReport = useAsyncAction(async (attempt: MyAttempt) => {
    const report = await getAttemptReport({ attemptId: attempt.attemptId });
    setView({ kind: "report", title: report.quizTitle, report });
    return report;
  });

  // Yayındaki sınav yüklenmeden karar verilmez: birden fazla devam eden girişim varsa onunki önceliklidir.
  const active =
    attempts.status === "ready" && published.status !== "loading"
      ? resumableAttempt(attempts.data, Date.now(), published.data?.id ?? null)
      : null;

  // Yenileme sonrası: devam eden girişime kendiliğinden dön (kullanıcı bilerek ayrılmadıysa).
  useEffect(() => {
    if (!active || autoResumed.current || leftManually.current || view.kind !== "panel") return;
    autoResumed.current = true;
    void begin.run(active.quizId);
  }, [active, view.kind, begin]);

  const onSubmitted = useCallback(
    (result: SubmitResponse, timedOut: boolean) => {
      const title = view.kind === "exam" ? view.start.quizTitle : "Sınav sonucu";
      setView({ kind: "report", title, report: { ...result, timedOut } });
    },
    [view]
  );

  if (view.kind === "exam") {
    return (
      <QuizExam
        quizId={view.quizId}
        start={view.start}
        clockOffsetMs={view.clockOffsetMs}
        onSubmitted={onSubmitted}
        onLeave={() => {
          leftManually.current = true;
          setView({ kind: "panel" });
        }}
      />
    );
  }

  const quiz = published.data;
  const mine = quiz && attempts.data ? (attempts.data.find((a) => a.quizId === quiz.id) ?? null) : null;
  const submitted = (attempts.data ?? []).filter((a) => a.status === "submitted");
  const progress = summarizeScores(
    submitted.map((a) => ({ score: a.score ?? 0, submittedAtMs: a.submittedAtMs ?? 0 }))
  );

  return (
    <div className="attendance-admin">
      {view.kind === "report" && (
        <>
          <div className="ui-actions">
            <Button variant="secondary" onClick={() => setView({ kind: "panel" })}>
              Sınavlarıma dön
            </Button>
          </div>
          <AttemptReport title={view.title} report={view.report} />
        </>
      )}

      {view.kind === "panel" && (
        <>
          {(published.error || attempts.error) && <Alert tone="critical">{published.error || attempts.error}</Alert>}
          {begin.error && <Alert tone="critical">{begin.error}</Alert>}
          {active && active.quizId !== quiz?.id && (
            <Card title={active.quizTitle} description="Sınav kapatıldı ama sizin süreniz devam ediyor.">
              <Button onClick={() => void begin.run(active.quizId)} loading={begin.pending} loadingText="Açılıyor…">
                Sınava devam et
              </Button>
            </Card>
          )}
          {published.status === "loading" ? (
            <p className="page-header-subtitle">Sınav durumu kontrol ediliyor…</p>
          ) : !quiz ? (
            <Card title="Sınav">
              <EmptyState
                title="Şu anda yayında sınav yok"
                description="Eğitim sorumlusu sınavı yayınladığında burada görünür."
              />
            </Card>
          ) : (
            <Card
              title={quiz.title}
              description={`${quiz.questionCount} soru · ${quiz.durationMinutes} dakika · Sonuçlar: ${REVEAL_POLICY_LABEL[quiz.revealPolicy].toLocaleLowerCase("tr")}`}
              actions={
                <StatusChip tone={mine?.status === "submitted" ? "success" : mine ? "warning" : "info"}>
                  {mine?.status === "submitted" ? "Teslim edildi" : mine ? "Devam ediyor" : "Başlanmadı"}
                </StatusChip>
              }
            >
              <div className="auth-stack">
                {quiz.closesAtMs && (
                  <p className="page-header-subtitle">Son giriş: {dateTime.format(quiz.closesAtMs)}</p>
                )}
                {!mine && (
                  <>
                    <p>
                      Başladığınız anda {quiz.durationMinutes} dakikalık süreniz işlemeye başlar ve durmaz. Yanıtlarınız
                      otomatik kaydedilir; bağlantı koparsa kaldığınız yerden devam edebilirsiniz.
                    </p>
                    <div className="ui-actions">
                      <Button
                        onClick={() => void begin.run(quiz.id)}
                        loading={begin.pending}
                        loadingText="Başlatılıyor…"
                      >
                        Sınava başla
                      </Button>
                    </div>
                  </>
                )}
                {mine?.status === "in_progress" &&
                  (mine.deadlineMs !== null && mine.deadlineMs <= Date.now() ? (
                    <div className="ui-actions">
                      <Button
                        onClick={() => void begin.run(quiz.id)}
                        loading={begin.pending}
                        loadingText="Sonuçlandırılıyor…"
                      >
                        Sonucu gör
                      </Button>
                      <span className="page-header-subtitle">
                        Süreniz {dateTime.format(mine.deadlineMs)} itibarıyla doldu; kaydedilmiş yanıtlarınız puanlanır.
                      </span>
                    </div>
                  ) : (
                    <div className="ui-actions">
                      <Button onClick={() => void begin.run(quiz.id)} loading={begin.pending} loadingText="Açılıyor…">
                        Sınava devam et
                      </Button>
                      {mine.deadlineMs && (
                        <span className="page-header-subtitle">
                          Süre {dateTime.format(mine.deadlineMs)} itibarıyla dolar.
                        </span>
                      )}
                    </div>
                  ))}
                {mine?.status === "submitted" && (
                  <div className="ui-actions">
                    <span>
                      Puanınız: <strong className="mono-num">{mine.score ?? "—"}</strong>
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() => void openReport.run(mine)}
                      loading={openReport.pending}
                      loadingText="Açılıyor…"
                    >
                      Karneyi görüntüle
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {submitted.length > 0 && (
            <Card title="Gelişimim" description="Teslim ettiğiniz sınavlardaki puanlarınız (0–100).">
              <div className="auth-stack">
                <ListLimitNotice
                  truncated={attempts.truncated}
                  cap={attempts.cap}
                  what="sınav girişimi"
                  hint="Özet ve grafik yalnızca bunları kapsar."
                />
                <dl className="lecture-stats" aria-label="Sınav özetim">
                  <div>
                    <dt>Sınav</dt>
                    <dd className="mono-num">{progress.count}</dd>
                  </div>
                  <div>
                    <dt>Son puan</dt>
                    <dd className="mono-num">{progress.latest ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Ortalama</dt>
                    <dd className="mono-num">{progress.average ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>En yüksek</dt>
                    <dd className="mono-num">{progress.best ?? "—"}</dd>
                  </div>
                </dl>
                {submitted.length > 1 && (
                  <ScoreTrend
                    label="Puan gelişimim"
                    points={submitted.map((a) => ({
                      id: a.attemptId,
                      label: a.quizTitle,
                      atMs: a.submittedAtMs ?? 0,
                      score: a.score ?? 0,
                      detail: `${a.correctCount ?? 0}/${a.totalQuestions ?? 0} doğru`,
                    }))}
                  />
                )}
              </div>
            </Card>
          )}

          <Card title="Sınav sonuçlarım" description="Teslim ettiğiniz sınavlar (yeniden eskiye).">
            {openReport.error && <Alert tone="critical">{openReport.error}</Alert>}
            <DataTable<MyAttempt>
              caption="Sınav sonuçlarım"
              captionHidden
              columns={[
                {
                  key: "date",
                  header: "Tarih",
                  cell: (a) => (a.submittedAtMs ? dateTime.format(a.submittedAtMs) : "—"),
                },
                { key: "title", header: "Sınav", rowHeader: true, cell: (a) => a.quizTitle },
                {
                  key: "score",
                  header: "Puan",
                  align: "end",
                  cell: (a) => (
                    <span className="mono-num">
                      {a.score ?? "—"} ({a.correctCount ?? 0}/{a.totalQuestions ?? 0})
                    </span>
                  ),
                },
                {
                  key: "action",
                  header: <span className="sr-only">İşlem</span>,
                  align: "end",
                  cell: (a) => (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void openReport.run(a)}
                      aria-label={`${a.quizTitle}: karne`}
                    >
                      Karne
                    </Button>
                  ),
                },
              ]}
              rows={submitted}
              rowKey={(a) => a.attemptId}
              loading={attempts.status === "loading"}
              error={attempts.error}
              empty={<EmptyState title="Henüz teslim ettiğiniz sınav yok" />}
            />
          </Card>
        </>
      )}
    </div>
  );
}
