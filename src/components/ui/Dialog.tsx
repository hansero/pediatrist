"use client";

import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useModalLayer } from "./useModalLayer";

export interface DialogProps {
  open: boolean;
  /** Esc ile (dismissible ise) çağrılır. Kapatma kararını üst bileşen verir. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Açılınca odaklanacak öğe. Verilmezse ilk odaklanabilir öğe, o da yoksa diyalogun kendisi. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Onay/uyarı diyalogları için `alertdialog`. */
  role?: "dialog" | "alertdialog";
  /** `false` ise Esc kapatmaz (ör. işlem sürerken). */
  dismissible?: boolean;
}

/**
 * Kipli diyalog (F3.1):
 * - Odak tuzağı (Tab / Shift+Tab diyalog içinde döner), başlangıç odağı, kapanınca odak geri döner.
 * - Arka plan `inert` yapılır: ekran okuyucu ve klavye diyalog dışına çıkamaz.
 * - Esc kapatır (`dismissible`); arka plana tıklayınca KAPANMAZ (yanlışlıkla kapatmayı önler).
 * - Açıkken sayfa kaydırması kilitlenir.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  initialFocusRef,
  role = "dialog",
  dismissible = true,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useModalLayer(open, {
    layerRef: containerRef,
    panelRef: dialogRef,
    initialFocusRef,
    onEscape: () => {
      if (dismissible) onClose();
    },
  });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div ref={containerRef} className="overlay-backdrop">
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="modal-dialog"
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId}>{title}</h2>
        {description && (
          <div id={descriptionId} className="ui-dialog-description">
            {description}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
