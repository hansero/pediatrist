"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";

export interface CountdownProps {
  /** Bitiş anı (epoch ms). Sunucunun verdiği değer kullanılmalı (ör. `deadlineMs`), istemci süresi değil. */
  deadlineMs: number;
  /** Erişilebilir ad, ör. "Kalan sınav süresi". */
  label: string;
  /** Sunucu saati − istemci saati (ms). Cihaz saati yanlışsa kalan süreyi düzeltir. */
  clockOffsetMs?: number;
  /** Bu saniyelerde ekran okuyucuya kibar duyuru yapılır ve görünüm uyarıya döner. */
  warnAtSeconds?: number[];
  /** Süre bittiğinde BİR kez çağrılır. */
  onExpire?: () => void;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Kalan süreyi `ss:dd:ss` (≥1 saat) veya `dd:ss` biçimine çevirir; kalan kısım yukarı yuvarlanır. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function announcement(label: string, seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) return `${label}: ${seconds / 60} dakika kaldı.`;
  return `${label}: ${seconds} saniye kaldı.`;
}

/**
 * Geri sayım (F3.1). Kendi state'ini tutar: üst bileşen her saniye yeniden çizilmez (AUDIT §7 performans).
 * - `role="timer"` her saniye DUYURULMAZ (gürültü); yalnızca `warnAtSeconds` eşiklerinde ayrı bir
 *   `aria-live="polite"` bölgesine kısa mesaj yazılır.
 * - Sekme arka plandayken zamanlayıcı yavaşlasa da kalan süre her tikte saatten yeniden hesaplanır.
 */
export function Countdown({
  deadlineMs,
  label,
  clockOffsetMs = 0,
  warnAtSeconds = [300, 60],
  onExpire,
  className,
}: CountdownProps) {
  const remainingAt = () => deadlineMs - (Date.now() + clockOffsetMs);
  const [remaining, setRemaining] = useState(remainingAt);
  const [message, setMessage] = useState("");
  const onExpireRef = useRef(onExpire);
  const expiredRef = useRef(false);
  const announcedRef = useRef(new Set<number>());

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expiredRef.current = false;
    announcedRef.current = new Set();
    // Eşiği bileşen açılmadan önce geçilmiş uyarılar duyurulmaz.
    const initialSeconds = Math.ceil((deadlineMs - (Date.now() + clockOffsetMs)) / 1000);
    for (const w of warnAtSeconds) if (initialSeconds <= w) announcedRef.current.add(w);

    const tick = () => {
      const ms = deadlineMs - (Date.now() + clockOffsetMs);
      setRemaining(ms);
      const seconds = Math.ceil(ms / 1000);
      for (const w of [...warnAtSeconds].sort((a, b) => a - b)) {
        if (seconds <= w && !announcedRef.current.has(w)) {
          announcedRef.current.add(w);
          for (const larger of warnAtSeconds) if (larger > w) announcedRef.current.add(larger);
          setMessage(announcement(label, w));
          break;
        }
      }
      if (ms <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        setMessage(`${label}: süre doldu.`);
        onExpireRef.current?.();
      }
      return ms;
    };

    if (tick() <= 0) return;
    const id = window.setInterval(() => {
      if (tick() <= 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
    // warnAtSeconds dizisinin içeriği önemlidir, kimliği değil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineMs, clockOffsetMs, label, warnAtSeconds.join(",")]);

  const seconds = Math.ceil(remaining / 1000);
  const warnFrom = warnAtSeconds.length ? Math.max(...warnAtSeconds) : -1;
  const state = remaining <= 0 ? "expired" : seconds <= warnFrom ? "warning" : "normal";

  return (
    <span className={cx("ui-countdown", className)} data-state={state}>
      <span role="timer" aria-label={label} className="mono-num">
        {formatRemaining(remaining)}
      </span>
      <span className="sr-only" aria-live="polite">
        {message}
      </span>
    </span>
  );
}
