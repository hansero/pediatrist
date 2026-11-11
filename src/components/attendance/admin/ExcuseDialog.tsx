"use client";

import React, { useEffect, useRef, useState } from "react";
import { LIMITS } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { markAttendanceExcused } from "@/lib/firebase/callables";

export interface ExcuseTarget {
  uid: string;
  name: string;
  /** Mevcut mazeret notu (düzenlemede alan dolu açılır). */
  excuseNote?: string;
}

/**
 * Mazeret girişi (F4.3; F4.5'te ders raporundan da). Canlı derste "bekleniyor", kapanmış derste "katılmadı"
 * olan hekim mazeretli işaretlenir; sunucu sayaçları ve denetim kaydını aynı işlemde günceller (D22).
 * Başarı yalnızca sunucu yanıtından sonra gösterilir.
 */
export function ExcuseDialog({
  sessionId,
  target,
  onClose,
}: {
  sessionId: string;
  target: ExcuseTarget | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const save = useAsyncAction(markAttendanceExcused);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // Dialog açılırken (veya başka hekim seçilince) mevcut not yüklenir. Nesne kimliğine değil değerlere bağlı:
  // canlı liste her güncellendiğinde yazılan metin silinmesin.
  const targetUid = target?.uid;
  const initialNote = target?.excuseNote ?? "";
  useEffect(() => {
    setNote(initialNote);
  }, [targetUid, initialNote]);

  function close() {
    if (save.pending) return;
    save.reset();
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (await save.run({ sessionId, targetUid: target.uid, excuseNote: note })) {
      toast.show(`${target.name} mazeretli olarak işaretlendi.`, { tone: "success" });
      close();
    }
  }

  return (
    <Dialog
      open={target !== null}
      onClose={close}
      title={target?.excuseNote ? "Mazereti düzenle" : "Mazeret gir"}
      description={target?.name}
      initialFocusRef={noteRef}
    >
      <form className="auth-stack" onSubmit={onSubmit} noValidate>
        {save.error && <Alert tone="critical">{save.error}</Alert>}
        <Field
          label="Mazeret notu"
          hint={`En fazla ${LIMITS.excuseNoteLength} karakter (ör. nöbet ertesi, yıllık izin).`}
        >
          {(p) => (
            <textarea
              {...p}
              ref={noteRef}
              className="form-textarea"
              rows={3}
              maxLength={LIMITS.excuseNoteLength}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        <div className="ui-dialog-actions">
          <Button variant="secondary" onClick={close} disabled={save.pending}>
            Vazgeç
          </Button>
          <Button type="submit" loading={save.pending} loadingText="Kaydediliyor…">
            Kaydet
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
