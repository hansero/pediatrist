"use client";

import { useEffect, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest("[inert]"));
}

export interface ModalLayerOptions {
  /** `document.body`'nin doğrudan çocuğu olan katman (portal kökü). Diğer kardeşler `inert` yapılır. */
  layerRef: RefObject<HTMLElement | null>;
  /** Odağın hapsedildiği öğe (dialog/çekmece paneli). */
  panelRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
}

/**
 * Kipli katman davranışı (Dialog, Drawer): açılınca arka planı `inert` yapar, kaydırmayı kilitler,
 * başlangıç odağını verir; kapanınca hepsini geri alır ve odağı açan öğeye döndürür.
 * Dönen `onKeyDown` panele bağlanır: Esc ve Tab/Shift+Tab odak tuzağı.
 */
export function useModalLayer(open: boolean, { layerRef, panelRef, initialFocusRef, onEscape }: ModalLayerOptions) {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const layer = layerRef.current;
    const madeInert: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el !== layer && !el.hasAttribute("inert")) {
        el.setAttribute("inert", "");
        madeInert.push(el);
      }
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const target = initialFocusRef?.current ?? (panel ? focusables(panel)[0] : null) ?? panel;
    target?.focus();

    return () => {
      for (const el of madeInert) el.removeAttribute("inert");
      document.body.style.overflow = overflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
    // Yalnızca açılış/kapanışta; ref nesneleri kararlıdır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onEscape?.();
      return;
    }
    const panel = panelRef.current;
    if (event.key !== "Tab" || !panel) return;
    const items = focusables(panel);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
}
