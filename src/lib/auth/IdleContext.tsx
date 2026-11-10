"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Hareketsizlik takibi (F3.3, AUDIT C8).
 *
 * - Son etkinlik zamanı bir ref'te tutulur; tek bir `setTimeout` bir sonraki karar anına kurulur.
 *   Saniyelik state güncellemesi ve tüm ağacın yeniden çizilmesi yok. State yalnızca
 *   "etkin ↔ uyarı" geçişinde değişir.
 * - `timeoutMs - warningMs` boyunca etkinlik olmazsa uyarı açılır; uyarı açıkken fare/klavye hareketi
 *   oturumu kendiliğinden uzatmaz, kullanıcı "Devam et" ile açıkça onaylar (`stayActive`).
 *   `timeoutMs` dolarsa `onTimeout` bir kez çağrılır.
 * - Aynı tarayıcıdaki diğer sekmelerdeki etkinlik `BroadcastChannel` ile paylaşılır: hekim başka sekmede
 *   çalışıyorsa bu sekme oturumu kapatmaz (uyarı açıksa kapanır).
 * - `useIdleExempt()` ile kayıtlı bir ekran (sınav, projektör) açıkken uyarı ve kapatma olmaz; muafiyet
 *   bittiğinde süre sıfırdan başlar.
 * - Cihaz uykusundan/arka plandan dönüşte (`visibilitychange`) süre saatten yeniden hesaplanır.
 */

export const IDLE_TIMEOUT_MS = 15 * 60_000;
export const IDLE_WARNING_MS = 60_000;
const CHANNEL = "pediatrist-idle";
const BROADCAST_THROTTLE_MS = 5_000;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

interface IdleApi {
  /** Uyarı açık mı? */
  warning: boolean;
  /** Oturumun kapanacağı an (epoch ms); uyarı geri sayımı için. */
  deadlineMs: number;
  /** "Devam et": süreyi sıfırlar ve uyarıyı kapatır. */
  stayActive: () => void;
  /** Muafiyet kaydı; dönen fonksiyon kaydı kaldırır. */
  registerExempt: () => () => void;
}

const IdleContext = createContext<IdleApi | null>(null);

export interface IdleProviderProps {
  onTimeout: () => void;
  timeoutMs?: number;
  warningMs?: number;
  children: ReactNode;
}

export function IdleProvider({
  onTimeout,
  timeoutMs = IDLE_TIMEOUT_MS,
  warningMs = IDLE_WARNING_MS,
  children,
}: IdleProviderProps) {
  const [warning, setWarning] = useState(false);
  const [deadlineMs, setDeadlineMs] = useState(0);
  const lastActivity = useRef(Date.now());
  const warningRef = useRef(false);
  const exemptCount = useRef(0);
  const timedOut = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const lastBroadcast = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const setWarningState = useCallback((value: boolean) => {
    warningRef.current = value;
    setWarning(value);
  }, []);

  /** Saate bakıp ne yapılacağına karar verir ve bir sonraki karar anına zamanlayıcı kurar. */
  const evaluate = useCallback(() => {
    window.clearTimeout(timer.current);
    if (timedOut.current) return;
    const now = Date.now();
    if (exemptCount.current > 0) {
      lastActivity.current = now;
      if (warningRef.current) setWarningState(false);
      return; // muafiyet bitince `evaluate` yeniden çağrılır
    }
    const idleFor = now - lastActivity.current;
    if (idleFor >= timeoutMs) {
      timedOut.current = true;
      setWarningState(false);
      onTimeoutRef.current();
      return;
    }
    if (idleFor >= timeoutMs - warningMs) {
      if (!warningRef.current) {
        setDeadlineMs(lastActivity.current + timeoutMs);
        setWarningState(true);
      }
      timer.current = window.setTimeout(evaluate, timeoutMs - idleFor);
      return;
    }
    if (warningRef.current) setWarningState(false);
    timer.current = window.setTimeout(evaluate, timeoutMs - warningMs - idleFor);
  }, [timeoutMs, warningMs, setWarningState]);

  const markActive = useCallback((at: number, broadcast: boolean) => {
    lastActivity.current = Math.max(lastActivity.current, at);
    if (broadcast && channel.current && at - lastBroadcast.current >= BROADCAST_THROTTLE_MS) {
      lastBroadcast.current = at;
      channel.current.postMessage({ type: "activity", at });
    }
  }, []);

  const stayActive = useCallback(() => {
    markActive(Date.now(), true);
    evaluate();
  }, [markActive, evaluate]);

  const registerExempt = useCallback(() => {
    exemptCount.current += 1;
    evaluate();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      exemptCount.current -= 1;
      lastActivity.current = Date.now();
      evaluate();
    };
  }, [evaluate]);

  useEffect(() => {
    timedOut.current = false;
    lastActivity.current = Date.now();

    const onActivity = () => {
      // Uyarı açıkken yalnızca açık onay ("Devam et") süreyi uzatır.
      if (warningRef.current) return;
      markActive(Date.now(), true);
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true });

    const onVisible = () => {
      if (document.visibilityState === "visible") evaluate();
    };
    document.addEventListener("visibilitychange", onVisible);

    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel(CHANNEL);
      channel.current.onmessage = (event: MessageEvent<{ type?: string; at?: unknown }>) => {
        if (event.data?.type === "activity" && typeof event.data.at === "number") {
          markActive(Math.min(event.data.at, Date.now()), false);
          evaluate();
        }
      };
    }

    evaluate();
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
      channel.current?.close();
      channel.current = null;
      window.clearTimeout(timer.current);
    };
  }, [evaluate, markActive]);

  const api = useMemo(
    () => ({ warning, deadlineMs, stayActive, registerExempt }),
    [warning, deadlineMs, stayActive, registerExempt]
  );
  return <IdleContext.Provider value={api}>{children}</IdleContext.Provider>;
}

export function useIdle(): IdleApi {
  const api = useContext(IdleContext);
  if (!api) throw new Error("useIdle, IdleProvider içinde kullanılmalı.");
  return api;
}

/**
 * Bu bileşen ekrandayken hareketsizlik kilidini devre dışı bırakır (sınav, projektör; C8).
 * `enabled=false` ile koşullu kullanılabilir (ör. yalnızca sınav sürerken).
 * IdleProvider dışında (ör. korumalı alan dışı) sessizce hiçbir şey yapmaz.
 */
export function useIdleExempt(enabled = true): void {
  const api = useContext(IdleContext);
  const register = api?.registerExempt;
  useEffect(() => {
    if (!enabled || !register) return;
    return register();
  }, [enabled, register]);
}
