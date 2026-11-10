"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute("inert"));
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

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const madeInert: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el !== container && !el.hasAttribute("inert")) {
        el.setAttribute("inert", "");
        madeInert.push(el);
      }
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const target = initialFocusRef?.current ?? (dialog ? focusables(dialog)[0] : null) ?? dialog;
    target?.focus();

    return () => {
      for (const el of madeInert) el.removeAttribute("inert");
      document.body.style.overflow = overflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
    // Yalnızca açılış/kapanışta çalışır; initialFocusRef ref nesnesidir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (dismissible) onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const items = focusables(dialogRef.current);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
