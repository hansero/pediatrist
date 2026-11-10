"use client";

import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { useModalLayer } from "./useModalLayer";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Panelin erişilebilir adı (ör. "Ana menü"). */
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Soldan açılan kipli çekmece (mobil menü). Dialog ile aynı odak/inert davranışı (`useModalLayer`);
 * Esc veya arka plana dokunma kapatır.
 */
export function Drawer({ open, onClose, label, children, className }: DrawerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onKeyDown = useModalLayer(open, { layerRef, panelRef, onEscape: onClose });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div ref={layerRef} className="ui-drawer-layer">
      {/* Klavye karşılığı Esc ve paneldeki "Menüyü kapat" düğmesidir; arka plan yalnızca dokunma kısayolu. */}
      <div className="ui-drawer-backdrop" aria-hidden="true" onClick={onClose} />
      {/* Odak tuzağı ve Esc için klavye dinleyicisi kipli panelin kendisinde olmalı (WAI-ARIA dialog deseni). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cx("ui-drawer", className)}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
