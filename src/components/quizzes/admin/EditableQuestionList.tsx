"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { QuestionEditorCard, cardIds } from "./QuestionEditorCard";
import { QuestionImagePicker } from "./QuestionImagePicker";
import type { CsvQuestions } from "./useCsvQuestions";

export const PREVIEW_STEP = 20;

/**
 * "Yeni sınav" önizlemesinde düzenlenebilir soru listesi (F14, D29). Değişiklikler yereldir; sunucuya yalnızca
 * "Taslak olarak kaydet" ile gider (orada da aynı şema). Odak: taşımada düğmede kalır, çıkarmada sonraki
 * sorunun başlığına geçer; taşıma ekran okuyucuya duyurulur.
 */
export function EditableQuestionList({
  csv,
  showKey,
  visible,
  setVisible,
  focusRequest,
}: {
  csv: CsvQuestions;
  showKey: boolean;
  visible: number;
  setVisible: (n: number) => void;
  /** "Soruya git": kartı açar ve başlığına odaklanır. */
  focusRequest: { key: string; seq: number } | null;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  const items = csv.items;
  const total = items.length;

  // Odak isteği bir sonraki çizimden sonra uygulanır (kart henüz DOM'da olmayabilir).
  useEffect(() => {
    if (!pendingFocus) return;
    document.getElementById(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, items]);

  useEffect(() => {
    if (!focusRequest) return;
    const index = items.findIndex((i) => i.key === focusRequest.key);
    if (index < 0) return;
    if (index >= visible) setVisible(Math.ceil((index + 1) / PREVIEW_STEP) * PREVIEW_STEP);
    setEditing((s) => new Set(s).add(focusRequest.key));
    setPendingFocus(cardIds(focusRequest.key).heading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  function setOpen(key: string, open: boolean) {
    setEditing((s) => {
      const next = new Set(s);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function move(key: string, delta: -1 | 1) {
    const from = items.findIndex((i) => i.key === key);
    const to = from + delta;
    if (to < 0 || to >= total) return;
    csv.move(key, delta);
    setAnnouncement(`Soru ${from + 1}, ${to + 1}. sıraya taşındı.`);
    if (to >= visible) setVisible(to + 1);
    // Kenara gelince basılan düğme devre dışı kalır: odak diğer yön düğmesine geçer.
    const ids = cardIds(key);
    const edge = to === 0 || to === total - 1;
    setPendingFocus(edge ? (delta === -1 ? ids.down : ids.up) : delta === -1 ? ids.up : ids.down);
  }

  function confirmRemove(key: string) {
    const index = items.findIndex((i) => i.key === key);
    const next = items[index + 1] ?? items[index - 1];
    csv.remove(key);
    setOpen(key, false);
    setAnnouncement(`Soru ${index + 1} sınavdan çıkarıldı. Kalan soru: ${total - 1}.`);
    setPendingFocus(next ? cardIds(next.key).heading : "csv-preview-heading");
  }

  const pickerItem = items.find((i) => i.key === pickerFor) ?? null;
  const removingItem = items.find((i) => i.key === removing) ?? null;

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {items.slice(0, visible).map((item) => (
        <QuestionEditorCard
          key={item.key}
          item={item}
          total={total}
          showKey={showKey}
          editing={editing.has(item.key)}
          onEdit={() => setOpen(item.key, true)}
          onDone={() => {
            csv.confirm(item.key);
            setOpen(item.key, false);
            setPendingFocus(cardIds(item.key).edit);
          }}
          onChange={(form) => csv.update(item.key, form)}
          onPickImage={() => setPickerFor(item.key)}
          onRemoveImage={() => {
            csv.setImage(item.key, "");
            setAnnouncement(`Soru ${item.number} görseli kaldırıldı.`);
          }}
          onMove={(d) => move(item.key, d)}
          onRemove={() => setRemoving(item.key)}
        />
      ))}
      {visible < total && (
        <Button variant="secondary" onClick={() => setVisible(visible + PREVIEW_STEP)}>
          {Math.min(PREVIEW_STEP, total - visible)} soru daha göster
        </Button>
      )}

      {pickerItem && (
        <QuestionImagePicker
          questionNumber={pickerItem.number}
          currentPath={pickerItem.form.imageUrl}
          onClose={() => setPickerFor(null)}
          onChoose={(path, how) => {
            csv.setImage(pickerItem.key, path);
            setPickerFor(null);
            toast.show(
              how === "uploaded"
                ? `Görsel yüklendi ve Soru ${pickerItem.number} için eklendi (${path}).`
                : `Görsel Soru ${pickerItem.number} için eklendi (${path}).`,
              { tone: "success" }
            );
          }}
        />
      )}
      <ConfirmDialog
        open={removingItem !== null}
        onClose={() => setRemoving(null)}
        title="Soruyu sınavdan çıkar"
        description={
          removingItem
            ? `Soru ${removingItem.number} (CSV satır ${removingItem.sourceRow}) bu taslağa eklenmez. Geri almak için CSV'yi yeniden seçmeniz gerekir; o zaman önizlemedeki diğer değişiklikler de silinir.`
            : ""
        }
        confirmLabel="Sınavdan çıkar"
        tone="danger"
        onConfirm={() => removingItem && confirmRemove(removingItem.key)}
      />
    </>
  );
}
