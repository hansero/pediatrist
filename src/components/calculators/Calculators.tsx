"use client";

import React, { useRef, useState } from "react";
import { LIMITS } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { updateCalculatorConfig } from "@/lib/firebase/callables";
import { PLANNED_CALCULATORS, type PlannedCalculator } from "@/lib/pediatrics";
import { useCalculatorNotes, type CalculatorNote } from "@/lib/pediatrics/config";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

/**
 * Hesaplayıcılar (F7.4, D8): dürüst "Yakında" durumu. Hiçbir hesaplama yapılmaz ve hiçbir güvenlik denetimi
 * "etkin" diye gösterilmez. Kliniğin protokol notu gerçek veridir (Firestore); admin callable ile düzenler.
 */
export function Calculators({ isAdmin }: { isAdmin: boolean }) {
  const notes = useCalculatorNotes();
  const [editing, setEditing] = useState<PlannedCalculator | null>(null);

  return (
    <div className="attendance-admin">
      <Alert tone="info" title="Hesaplayıcılar yakında">
        Bu sayfada henüz hesaplama yapılmaz. Hesaplayıcılar doğrulanmış formüller ve referans değer testleriyle ayrı bir
        aşamada eklenecek. Klinik kararlar için kurumunuzun protokollerini kullanın.
      </Alert>
      {notes.error && <Alert tone="critical">{notes.error}</Alert>}
      <ul className="calculator-grid" aria-label="Planlanan hesaplayıcılar">
        {PLANNED_CALCULATORS.map((c) => (
          <li key={c.id}>
            <CalculatorCard
              calc={c}
              note={notes.data?.get(c.id) ?? null}
              loading={notes.status === "loading"}
              onEdit={isAdmin ? () => setEditing(c) : undefined}
            />
          </li>
        ))}
      </ul>
      {isAdmin && (
        // Anahtar: her açılışta yeni bileşen → başlangıç metni ilk çizimde hazır (açıldıktan sonra efektle
        // doldurmak, o arada yazılanı ezebiliyordu; F7.4 e2e yakaladı).
        <NoteDialog
          key={editing?.id ?? "kapali"}
          calc={editing}
          current={editing ? (notes.data?.get(editing.id)?.protocolNote ?? "") : ""}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CalculatorCard({
  calc,
  note,
  loading,
  onEdit,
}: {
  calc: PlannedCalculator;
  note: CalculatorNote | null;
  loading: boolean;
  onEdit?: () => void;
}) {
  return (
    <Card
      title={calc.title}
      headingLevel={2}
      description={`${calc.code} · ${calc.categoryLabel}`}
      actions={<StatusChip tone="info">Yakında</StatusChip>}
    >
      <div className="auth-stack">
        <p>{calc.summary}</p>
        <dl className="calculator-plan">
          <div>
            <dt>Planlanan girdiler</dt>
            <dd>{calc.plannedInputs.join(" · ")}</dd>
          </div>
          <div>
            <dt>Planlanan çıktılar</dt>
            <dd>{calc.plannedOutputs.join(" · ")}</dd>
          </div>
          <div>
            <dt>Planlanan güvenlik denetimi (henüz etkin değil)</dt>
            <dd>{calc.plannedSafetyCheck}</dd>
          </div>
        </dl>
        <section className="calculator-note" aria-label={`${calc.title}: klinik protokol notu`}>
          <h3>Klinik protokol notu</h3>
          {loading ? (
            <p className="page-header-subtitle">Yükleniyor…</p>
          ) : note ? (
            <>
              <p className="calculator-note-text">{note.protocolNote}</p>
              <p className="page-header-subtitle">
                {note.updatedByName || "Eğitim sorumlusu"}
                {note.updatedAtMs ? ` · ${dateFormat.format(note.updatedAtMs)}` : ""}
              </p>
            </>
          ) : (
            <p className="page-header-subtitle">Eğitim sorumlusu henüz protokol notu eklemedi.</p>
          )}
          {onEdit && (
            <div className="ui-actions">
              <Button size="sm" variant="secondary" onClick={onEdit}>
                {note ? "Notu düzenle" : "Not ekle"}
                <span className="sr-only">: {calc.title}</span>
              </Button>
            </div>
          )}
        </section>
      </div>
    </Card>
  );
}

function NoteDialog({
  calc,
  current,
  onClose,
}: {
  calc: PlannedCalculator | null;
  current: string;
  onClose: () => void;
}) {
  const toast = useToast();
  // Başlangıç metni yalnızca açılışta alınır: canlı güncelleme yazılmakta olanı ezmez.
  const [text, setText] = useState(current);
  const save = useAsyncAction(updateCalculatorConfig);
  const ref = useRef<HTMLTextAreaElement>(null);

  function close() {
    if (save.pending) return;
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!calc) return;
    const res = await save.run({ calculatorId: calc.id, protocolNote: text });
    if (res) {
      toast.show(res.cleared ? "Protokol notu kaldırıldı." : "Protokol notu kaydedildi.", { tone: "success" });
      onClose();
    }
  }

  return (
    <Dialog
      open={calc !== null}
      onClose={close}
      title="Klinik protokol notu"
      description={calc?.title}
      initialFocusRef={ref}
      dismissible={!save.pending}
    >
      <form className="auth-stack" onSubmit={onSubmit} noValidate>
        {save.error && <Alert tone="critical">{save.error}</Alert>}
        <Field
          label="Protokol notu"
          hint={`Kurum protokolüne yönlendiren kısa not (en fazla ${LIMITS.protocolNoteLength} karakter). Boş bırakılırsa not kaldırılır.`}
        >
          {(p) => (
            <textarea
              {...p}
              ref={ref}
              className="form-textarea"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
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
