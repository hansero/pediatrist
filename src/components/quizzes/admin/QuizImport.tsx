"use client";

import React, { useEffect, useState } from "react";
import { DEFAULT_REVEAL_POLICY, LIMITS } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { saveQuizDraft } from "@/lib/firebase/callables";
import { CsvQuestionsPanel } from "./CsvQuestionsPanel";
import {
  fromLocalInput,
  QuizSettingsFields,
  validateSettings,
  type QuizSettingsValue,
  type SettingsErrors,
} from "./QuizSettingsFields";
import { useCsvQuestions } from "./useCsvQuestions";

/**
 * Yeni sınav (F5.2): CSV → ortak doğrulayıcı → önizleme → `saveQuizDraft`. Taslak hekimlere görünmez; yayın
 * "Sınavlar" sekmesinden yapılır. Başarı yalnızca sunucu yanıtından sonra gösterilir.
 *
 * F14 (D29): önizlemede sorular düzenlenir, görsel eklenir, sıra değişir; değişiklikler yereldir. Kaydedilmemiş
 * değişiklik varken sayfadan çıkış uyarı verir; sekme değişince durum korunur (`QuizAdmin` → `keepMounted`).
 */
export function QuizImport({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const csv = useCsvQuestions();
  const [title, setTitle] = useState("");
  const [settings, setSettings] = useState<QuizSettingsValue>({
    durationMinutes: "20",
    closesAtLocal: "",
    revealPolicy: DEFAULT_REVEAL_POLICY,
  });
  const [errors, setErrors] = useState<SettingsErrors & { title?: string }>({});
  const save = useAsyncAction(saveQuizDraft);

  const dirty = csv.dirty;
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found: SettingsErrors & { title?: string } = validateSettings(settings);
    if (!title.trim()) found.title = "Sınav başlığı zorunlu.";
    setErrors(found);
    if (Object.keys(found).length || !csv.ready) return;
    const res = await save.run({
      title,
      durationMinutes: Number(settings.durationMinutes),
      closesAtMs: fromLocalInput(settings.closesAtLocal),
      revealPolicy: settings.revealPolicy,
      sourceFileName: csv.fileName,
      questions: csv.questions,
      editedInPreview: csv.editedInPreview,
    });
    if (res) {
      toast.show(`"${title.trim()}" taslak olarak kaydedildi (${res.questionCount} soru).`, { tone: "success" });
      setTitle("");
      csv.reset();
      onSaved();
    }
  }

  return (
    <Card
      title="Yeni sınav"
      description="CSV'yi yükleyin; önizlemede soruları düzenleyip görsel ekleyebilir, sonra taslak olarak kaydedebilirsiniz. Taslak, siz yayınlayana kadar hekimlere görünmez."
    >
      <form className="auth-stack" onSubmit={onSubmit} noValidate>
        {save.error && <Alert tone="critical">{save.error}</Alert>}
        <CsvQuestionsPanel csv={csv} editable />
        <Field label="Sınav başlığı" error={errors.title} required>
          {(p) => (
            <input
              {...p}
              className="form-input"
              maxLength={LIMITS.titleLength}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <QuizSettingsFields idPrefix="new-quiz" value={settings} onChange={setSettings} errors={errors} />
        <div className="ui-actions">
          <Button type="submit" loading={save.pending} loadingText="Kaydediliyor…" disabled={!csv.ready}>
            Taslak olarak kaydet
          </Button>
          {!csv.ready && (
            <span className="page-header-subtitle">
              {!csv.fileName
                ? "Önce bir CSV seçin."
                : csv.mediaCheck === "checking"
                  ? "Görseller denetleniyor…"
                  : "Hatalar giderilmeden kaydedilemez."}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
