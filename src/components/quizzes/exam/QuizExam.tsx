"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CallableResponse } from "@shared/schemas";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Countdown } from "@/components/ui/Countdown";
import { useIdleExempt } from "@/lib/auth/IdleContext";
import { toUserMessage } from "@/lib/errors";
import { saveAttemptDraft, submitQuizAttempt } from "@/lib/firebase/callables";
import { createSaveQueue, isAnswered } from "@/lib/quiz/doctor";
import { ExamQuestion } from "./ExamQuestion";

type StartResponse = CallableResponse<"startQuizAttempt">;
export type SubmitResponse = CallableResponse<"submitQuizAttempt">;
type Responses = Record<string, string[]>;

/** Yanıtlar son değişiklikten bu kadar sonra sunucuya kaydedilir; soru değiştirirken hemen kaydedilir. */
export const SAVE_DEBOUNCE_MS = 3_000;

const clock = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const hm = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

type SaveState =
  | { status: "idle" }
  | { status: "dirty" }
  | { status: "saving" }
  | { status: "saved"; atMs: number }
  | { status: "error"; message: string };

/**
 * Sınav ekranı (F5.3). Sorular, bitiş anı ve kaydedilmiş yanıtlar `startQuizAttempt`'ten gelir.
 * - Geri sayım sunucunun `deadlineMs`'i ve saat farkıyla; 5 dk ve 1 dk kala ekran okuyucuya duyurulur.
 * - Yanıtlar ~3 sn sonra (`saveAttemptDraft`) ve soru değiştirirken kaydedilir; sayfa yenilenirse devam edilir.
 * - Süre bitince otomatik teslim; teslim kilidi çift teslimi engeller (sunucu da engeller).
 * - Ekran kilidi bu ekranda devre dışı (`useIdleExempt`): uzun vaka okurken oturum kapanmaz.
 */
export function QuizExam({
  quizId,
  start,
  clockOffsetMs,
  onSubmitted,
  onLeave,
}: {
  quizId: string;
  start: StartResponse;
  clockOffsetMs: number;
  onSubmitted: (result: SubmitResponse) => void;
  onLeave: () => void;
}) {
  useIdleExempt();
  const questions = start.questions;
  const [responses, setResponses] = useState<Responses>(() => ({ ...start.savedResponses }));
  const [index, setIndex] = useState(0);
  const [save, setSave] = useState<SaveState>(
    Object.keys(start.savedResponses).length ? { status: "saved", atMs: Date.now() } : { status: "idle" }
  );
  const [expired, setExpired] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const tabSwitches = useRef(0);
  const responsesRef = useRef(responses);
  const dirty = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Tek teslim kilidi: onay diyaloğu ve süre bitimi aynı anda teslim edemez (sunucu da çift teslimi reddeder).
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoSubmitError, setAutoSubmitError] = useState("");

  const queue = useMemo(
    () =>
      createSaveQueue<Responses>(async (value) => {
        setSave({ status: "saving" });
        try {
          await saveAttemptDraft({ quizId, responses: value });
          // Kayıt sürerken yeni değişiklik olduysa "kaydedildi" denmez: o değişiklik henüz sunucuda değil.
          setSave(dirty.current ? { status: "dirty" } : { status: "saved", atMs: Date.now() });
        } catch (err) {
          setSave({ status: "error", message: toUserMessage(err) });
          throw err;
        }
      }),
    [quizId]
  );

  const saveNow = useCallback(() => {
    if (!dirty.current) return queue.flush();
    dirty.current = false;
    return queue.push(responsesRef.current);
  }, [queue]);

  // Değişiklikten SAVE_DEBOUNCE_MS sonra kaydet.
  useEffect(() => {
    responsesRef.current = responses;
    if (!dirty.current) return;
    const id = window.setTimeout(() => void saveNow().catch(() => undefined), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [responses, saveNow]);

  // Sekme değişimi sayımı (bilgi amaçlı; puanı etkilemez).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") tabSwitches.current += 1;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Kaydedilmemiş yanıt varken sayfadan çıkışta tarayıcı uyarısı.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current || queue.pending) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [queue]);

  function setAnswer(questionId: string, value: string[]) {
    dirty.current = true;
    setSave((s): SaveState => (s.status === "saving" ? s : { status: "dirty" }));
    setResponses((r) => ({ ...r, [questionId]: value }));
  }

  function goTo(next: number) {
    void saveNow().catch(() => undefined);
    setIndex(next);
    // Yeni sorunun başlığına odak: ekran okuyucu ve klavye kullanıcısı yeni içerikte başlar.
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  const submitOnce = useCallback(async (): Promise<void> => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await submitQuizAttempt({
        quizId,
        responses: responsesRef.current,
        tabSwitchCount: tabSwitches.current,
      });
      dirty.current = false;
      onSubmitted(res);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [quizId, onSubmitted]);

  const onExpire = useCallback(() => {
    setExpired(true);
    setConfirmSubmit(false);
    setAutoSubmitError("");
    submitOnce().catch((err: unknown) => setAutoSubmitError(toUserMessage(err)));
  }, [submitOnce]);

  const answeredCount = questions.filter((q) => isAnswered(responses[q.questionId])).length;
  const unanswered = questions.length - answeredCount;
  const question = questions[index];

  const saveText =
    save.status === "dirty"
      ? "Değişiklikler birazdan kaydedilecek…"
      : save.status === "saving"
        ? "Kaydediliyor…"
        : save.status === "saved"
          ? `Yanıtlar kaydedildi (${clock.format(save.atMs)})`
          : save.status === "error"
            ? `Kaydedilemedi: ${save.message}`
            : "Yanıtlarınız otomatik kaydedilir.";

  return (
    <section className="exam" aria-labelledby="exam-title">
      <header className="exam-bar">
        <div className="exam-bar-title">
          <h2 id="exam-title">{start.quizTitle}</h2>
          <p className={save.status === "error" ? "ui-field-error" : "page-header-subtitle"} aria-live="polite">
            {saveText}
          </p>
        </div>
        <div className="exam-bar-actions">
          <Countdown
            deadlineMs={start.deadlineMs}
            clockOffsetMs={clockOffsetMs}
            label="Kalan sınav süresi"
            warnAtSeconds={[300, 60]}
            onExpire={onExpire}
            className="exam-countdown"
          />
          <Button variant="secondary" size="sm" onClick={() => setConfirmLeave(true)} disabled={submitting}>
            Sınavdan ayrıl
          </Button>
        </div>
      </header>

      {expired && (
        <Alert tone={autoSubmitError ? "critical" : "warning"} title="Süre doldu">
          {autoSubmitError
            ? `Teslim edilemedi: ${autoSubmitError} Süre içinde kaydedilen yanıtlarınız puanlanacak.`
            : "Yanıtlarınız teslim ediliyor…"}
        </Alert>
      )}

      <nav aria-label="Sorular" className="exam-nav">
        {questions.map((q, i) => {
          const answered = isAnswered(responses[q.questionId]);
          return (
            <button
              key={q.questionId}
              type="button"
              className={`exam-pill${answered ? " answered" : ""}`}
              aria-label={`Soru ${i + 1}, ${answered ? "yanıtlandı" : "yanıtlanmadı"}`}
              aria-current={i === index ? "step" : undefined}
              onClick={() => goTo(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      {question && (
        <ExamQuestion
          key={question.questionId}
          question={question}
          number={index + 1}
          total={questions.length}
          value={responses[question.questionId] ?? []}
          onChange={(v) => setAnswer(question.questionId, v)}
          disabled={submitting || expired}
          headingRef={headingRef}
        />
      )}

      <footer className="exam-footer">
        <Button variant="secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
          Önceki
        </Button>
        <span className="page-header-subtitle">
          {answeredCount} / {questions.length} yanıtlandı
        </span>
        {index < questions.length - 1 ? (
          <Button variant="secondary" onClick={() => goTo(index + 1)}>
            Sonraki
          </Button>
        ) : (
          <Button onClick={() => setConfirmSubmit(true)} disabled={expired}>
            Sınavı teslim et
          </Button>
        )}
      </footer>
      {index < questions.length - 1 && (
        <div className="ui-actions exam-submit-early">
          <Button variant="ghost" onClick={() => setConfirmSubmit(true)} disabled={expired}>
            Sınavı teslim et
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        title="Sınavı teslim et"
        description={
          unanswered
            ? `${unanswered} soru yanıtlanmadı. Teslimden sonra yanıtlar değiştirilemez.`
            : "Bütün sorular yanıtlandı. Teslimden sonra yanıtlar değiştirilemez."
        }
        confirmLabel="Teslim et"
        pendingLabel="Teslim ediliyor…"
        onConfirm={submitOnce}
      />
      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Sınavdan ayrıl"
        description={`Süreniz DURMAZ ve ${hm.format(start.deadlineMs - clockOffsetMs)} itibarıyla dolar. Yanıtlarınız kaydedilir; süre bitmeden dönüp devam edebilirsiniz. Süre dolarsa kaydedilmiş yanıtlarınız puanlanır.`}
        confirmLabel="Kaydet ve ayrıl"
        pendingLabel="Kaydediliyor…"
        onConfirm={async () => {
          await saveNow();
          onLeave();
        }}
      />
    </section>
  );
}
