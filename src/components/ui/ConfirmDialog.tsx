"use client";

import { useRef, type ReactNode } from "react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Kimi/neyi etkileyeceğini ve sonucunu açıkça söyleyin (ör. "Dr. X'in oturumu kapanır"). */
  description: ReactNode;
  confirmLabel: string;
  /** Yüklenirken onay butonunda gösterilir. */
  pendingLabel?: string;
  cancelLabel?: string;
  /** Geri alınamaz/yetki veren işlemler için `danger`. */
  tone?: "danger" | "primary";
  /**
   * Sunucu işlemi. Diyalog işlem BİTENE kadar açık kalır; başarıda kapanır, hatada Türkçe hata gösterilir
   * ve diyalog açık kalır (CLAUDE.md kural 2: iyimser başarı yok).
   */
  onConfirm: () => Promise<unknown> | unknown;
  children?: ReactNode;
}

/**
 * Onay diyalogu. Başlangıç odağı "Vazgeç" butonundadır: Enter'a yanlışlıkla basmak işlemi yapmaz.
 * İşlem sürerken Esc ve "Vazgeç" devre dışıdır (sonucu bilinmeyen işlemden "kaçış" yok).
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Vazgeç",
  tone = "danger",
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const action = useAsyncAction(async () => {
    await onConfirm();
    return true as const;
  });

  function close() {
    if (action.pending) return;
    action.reset();
    onClose();
  }

  async function confirm() {
    if (await action.run()) {
      action.reset();
      onClose();
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      role="alertdialog"
      initialFocusRef={cancelRef}
      dismissible={!action.pending}
    >
      {children}
      {action.error && <Alert tone="critical">{action.error}</Alert>}
      <div className="ui-dialog-actions">
        <Button ref={cancelRef} variant="secondary" onClick={close} disabled={action.pending}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          loading={action.pending}
          loadingText={pendingLabel}
          onClick={confirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
