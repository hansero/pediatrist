"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx, type Tone } from "./cx";

export interface ToastOptions {
  tone?: Tone;
  title?: string;
  /** Otomatik kapanma (ms). `critical` varsayılan olarak kendiliğinden kapanmaz. */
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, "tone">> {
  id: number;
  message: string;
  title?: string;
  durationMs: number | null;
}

interface ToastApi {
  /**
   * Bildirim gösterir. Başarı bildirimi YALNIZCA sunucu yanıtı geldikten sonra gösterilir
   * (CLAUDE.md kural 2); hatalar `toUserMessage(err)` ile.
   */
  show: (message: string, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION: Record<Tone, number | null> = {
  success: 5000,
  info: 5000,
  warning: 8000,
  critical: null,
};

/**
 * Bildirim sağlayıcısı (kök layout'ta bir kez). İki canlı bölge sayfada baştan bulunur
 * (dinamik eklenen bölgeler duyurulmaz): kibar (`status`) ve acil (`alert`, yalnızca critical).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback((message: string, options: ToastOptions = {}) => {
    const tone = options.tone ?? "info";
    const durationMs = options.durationMs ?? DEFAULT_DURATION[tone];
    const item: ToastItem = { id: nextId.current++, message, title: options.title, tone, durationMs };
    setItems((list) => [...list.slice(-4), item]);
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const polite = items.filter((t) => t.tone !== "critical");
  const urgent = items.filter((t) => t.tone === "critical");

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toast-region">
        <div role="status" aria-live="polite" className="ui-toast-stack">
          {polite.map((t) => (
            <ToastView key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>
        <div role="alert" aria-live="assertive" className="ui-toast-stack">
          {urgent.map((t) => (
            <ToastView key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    if (item.durationMs === null) return;
    const id = window.setTimeout(() => onDismiss(item.id), item.durationMs);
    return () => window.clearTimeout(id);
  }, [item.id, item.durationMs, onDismiss]);

  return (
    <div className={cx("clinical-alert", "ui-alert", item.tone, "ui-toast")}>
      <div className="clinical-alert-body">
        {item.title && <strong className="clinical-alert-title">{item.title}</strong>}
        <div>{item.message}</div>
      </div>
      <button type="button" className="ui-icon-btn" aria-label="Bildirimi kapat" onClick={() => onDismiss(item.id)}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast, ToastProvider içinde kullanılmalı.");
  return api;
}
