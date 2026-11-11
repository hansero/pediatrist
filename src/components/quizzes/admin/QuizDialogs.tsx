"use client";

import React, { useEffect, useRef, useState } from "react";
import { LIMITS } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { publishQuiz, updateQuizDraft } from "@/lib/firebase/callables";
import type { QuizSummary } from "@/lib/quiz/admin";
import { CsvQuestionsPanel } from "./CsvQuestionsPanel";
import {
  fromLocalInput,
  QuizSettingsFields,
  toLocalInput,
  validateSettings,
  type QuizSettingsValue,
  type SettingsErrors,
} from "./QuizSettingsFields";
import { useCsvQuestions } from "./useCsvQuestions";

const settingsOf = (quiz: QuizSummary | null): QuizSettingsValue => ({
  durationMinutes: String(quiz?.durationMinutes ?? 20),
  closesAtLocal: toLocalInput(quiz?.closesAtMs ?? null),
  revealPolicy: quiz?.revealPolicy ?? "after_close",
});

/**
 * Taslağı yayınla (F5.2). Yayındaki sınavda hâlâ sınavda olan hekim varsa sunucu yayını YAPMAZ ve sayıyı
 * döner; diyalog açık onay ister ve `force: true` ile tekrar çağırır.
 */
export function PublishDialog({ quiz, onClose }: { quiz: QuizSummary | null; onClose: () => void }) {
  const toast = useToast();
  const [settings, setSettings] = useState<QuizSettingsValue>(settingsOf(quiz));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [needsForce, setNeedsForce] = useState<{ inProgressCount: number; currentQuizTitle: string } | null>(null);
  const publish = useAsyncAction(publishQuiz);

  const quizId = quiz?.id;
  useEffect(() => {
    setSettings(settingsOf(quiz));
    setErrors({});
    setNeedsForce(null);
    publish.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  function close() {
    if (publish.pending) return;
    onClose();
  }

  async function run(force: boolean) {
    if (!quiz) return;
    const found = validateSettings(settings);
    setErrors(found);
    if (Object.keys(found).length) return;
    const res = await publish.run({
      quizId: quiz.id,
      durationMinutes: Number(settings.durationMinutes),
      closesAtMs: fromLocalInput(settings.closesAtLocal),
      revealPolicy: settings.revealPolicy,
      force,
    });
    if (!res) return;
    if (!res.published) {
      setNeedsForce({ inProgressCount: res.inProgressCount, currentQuizTitle: res.currentQuizTitle });
      return;
    }
    toast.show(
      res.archivedPreviousCount
        ? `"${quiz.title}" yayında. Önceki sınav kapatılıp arşivlendi.`
        : `"${quiz.title}" yayında; hekimler sınava girebilir.`,
      { tone: "success" }
    );
    onClose();
  }

  return (
    <Dialog
      open={quiz !== null}
      onClose={close}
      title="Sınavı yayınla"
      description={quiz ? `${quiz.title} · ${quiz.questionCount} soru` : undefined}
      dismissible={!publish.pending}
    >
      <form
        className="auth-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void run(false);
        }}
      >
        {publish.error && <Alert tone="critical">{publish.error}</Alert>}
        {needsForce ? (
          <>
            <Alert tone="warning" title={`${needsForce.inProgressCount} hekim hâlâ sınavda`}>
              Yayınlarsanız &quot;{needsForce.currentQuizTitle}&quot; kapanır ve arşivlenir. Sınavdaki hekimler süreleri
              dolana kadar teslim edebilir; yeni giriş alınmaz.
            </Alert>
            <div className="ui-dialog-actions">
              <Button variant="secondary" onClick={() => setNeedsForce(null)} disabled={publish.pending}>
                Geri
              </Button>
              <Button onClick={() => void run(true)} loading={publish.pending} loadingText="Yayınlanıyor…">
                Yine de yayınla
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="page-header-subtitle">
              Yayındaki bir sınav varsa kapatılıp soruları arşive taşınır. Yayından sonra sorular değiştirilemez.
            </p>
            <QuizSettingsFields idPrefix="publish" value={settings} onChange={setSettings} errors={errors} />
            <div className="ui-dialog-actions">
              <Button variant="secondary" onClick={close} disabled={publish.pending}>
                Vazgeç
              </Button>
              <Button type="submit" loading={publish.pending} loadingText="Yayınlanıyor…">
                Yayınla
              </Button>
            </div>
          </>
        )}
      </form>
    </Dialog>
  );
}

/** Taslağı düzenle (F5.2): ayarlar ve isteğe bağlı olarak soru setinin tamamını yeni CSV ile değiştirme. */
export function EditDraftDialog({ quiz, onClose }: { quiz: QuizSummary | null; onClose: () => void }) {
  const toast = useToast();
  const csv = useCsvQuestions();
  const [title, setTitle] = useState(quiz?.title ?? "");
  const [settings, setSettings] = useState<QuizSettingsValue>(settingsOf(quiz));
  const [errors, setErrors] = useState<SettingsErrors & { title?: string }>({});
  const update = useAsyncAction(updateQuizDraft);
  const titleRef = useRef<HTMLInputElement>(null);

  const quizId = quiz?.id;
  useEffect(() => {
    setTitle(quiz?.title ?? "");
    setSettings(settingsOf(quiz));
    setErrors({});
    csv.reset();
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  const replacing = csv.fileName !== "";

  function close() {
    if (update.pending) return;
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quiz) return;
    const found: SettingsErrors & { title?: string } = validateSettings(settings);
    if (!title.trim()) found.title = "Sınav başlığı zorunlu.";
    setErrors(found);
    if (Object.keys(found).length || (replacing && !csv.ready)) return;
    const res = await update.run({
      quizId: quiz.id,
      title,
      durationMinutes: Number(settings.durationMinutes),
      closesAtMs: fromLocalInput(settings.closesAtLocal),
      revealPolicy: settings.revealPolicy,
      ...(replacing ? { questions: csv.questions, sourceFileName: csv.fileName } : {}),
    });
    if (res) {
      toast.show(`Taslak güncellendi (${res.questionCount} soru).`, { tone: "success" });
      onClose();
    }
  }

  return (
    <Dialog
      open={quiz !== null}
      onClose={close}
      title="Taslağı düzenle"
      description={quiz ? `${quiz.questionCount} soru · ${quiz.sourceFileName || "CSV"}` : undefined}
      initialFocusRef={titleRef}
      dismissible={!update.pending}
    >
      <form className="auth-stack" onSubmit={onSubmit} noValidate>
        {update.error && <Alert tone="critical">{update.error}</Alert>}
        <Field label="Sınav başlığı" error={errors.title} required>
          {(p) => (
            <input
              {...p}
              ref={titleRef}
              className="form-input"
              maxLength={LIMITS.titleLength}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <QuizSettingsFields idPrefix="edit" value={settings} onChange={setSettings} errors={errors} />
        <CsvQuestionsPanel csv={csv} label="Soruları değiştir (isteğe bağlı, yeni CSV)" />
        <div className="ui-dialog-actions">
          <Button variant="secondary" onClick={close} disabled={update.pending}>
            Vazgeç
          </Button>
          <Button type="submit" loading={update.pending} loadingText="Kaydediliyor…" disabled={replacing && !csv.ready}>
            {replacing ? `Kaydet (${csv.questions.length} yeni soru)` : "Kaydet"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
