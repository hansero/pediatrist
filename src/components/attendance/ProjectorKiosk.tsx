"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { isLectureOpen, useLecture } from "@/lib/attendance/live";
import { useIdleExempt } from "@/lib/auth/IdleContext";
import { withClockOffset } from "@/lib/clock";
import { toAppError } from "@/lib/errors";
import { getProjectorCode } from "@/lib/firebase/callables";

interface CodeState {
  code: string;
  /** Bir sonraki kodun geçerli olacağı an (istemci saatiyle). */
  rotatesAtMs: number;
}

const RETRY_MS = 5_000;

/**
 * Projektör ekranı (F4.3, AUDIT C2/C8). Kod sunucuda HMAC ile üretilir; ekran onu yalnızca gösterir.
 * - `getProjectorCode` sunucunun bildirdiği yenilenme anında (`msUntilRotation`) yeniden çağrılır.
 * - Geçici ağ hatasında 5 sn sonra tekrar denenir; ders bittiyse durur.
 * - Ekran kilidi muafiyeti (`useIdleExempt`) ve Screen Wake Lock (destekleniyorsa) ile ekran açık kalır.
 * - Ders salonu bilgisayarının saati kayabilir (F13.2): dersin kapanışı sunucu saatine göre değerlendirilir
 *   (`serverNowMs` → saat farkı). Kod döngüsü yerel saate değil dersin `live` durumuna göre başlar; böylece
 *   saati ileri olan bilgisayar da ilk yanıtta farkı öğrenir. Ders bittiyse sunucu `failed-precondition` döner.
 */
export function ProjectorKiosk({ sessionId }: { sessionId: string }) {
  useIdleExempt();
  const lecture = useLecture(sessionId);
  const [code, setCode] = useState<CodeState | null>(null);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  /** Sunucu saati − bu bilgisayarın saati; ilk koddan önce bilinmez (o zamana kadar dersin durumuna güvenilir). */
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const wakeLockSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  const statusLive = lecture.status === "ready" && lecture.data?.status === "live" && !ended;
  const live = statusLive && (offsetMs === null || isLectureOpen(lecture.data, Date.now() + offsetMs));

  // Kod döngüsü
  useEffect(() => {
    if (!statusLive) return;
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const { result: res, offsetMs: offset } = await withClockOffset(() => getProjectorCode({ sessionId }));
        if (cancelled) return;
        setError("");
        setOffsetMs(offset);
        setCode({ code: res.code, rotatesAtMs: Date.now() + res.msUntilRotation });
        timer = window.setTimeout(tick, res.msUntilRotation + 150);
      } catch (err) {
        if (cancelled) return;
        const e = toAppError(err);
        if (e.code === "failed-precondition") {
          setEnded(true);
          setCode(null);
          return;
        }
        setError(e.message);
        timer = window.setTimeout(tick, RETRY_MS);
      }
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionId, statusLive]);

  // Ekranı açık tut (Screen Wake Lock); sekme yeniden görünür olunca kilit yeniden alınır.
  useEffect(() => {
    if (!wakeLockSupported || !live) return;
    let sentinel: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Pil tasarrufu vb. nedenlerle reddedilebilir; ekran kilidi muafiyeti yine geçerli.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [live, wakeLockSupported]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await containerRef.current?.requestFullscreen();
    } catch {
      setError("Tam ekran açılamadı. Tarayıcının tam ekran tuşunu (F11) kullanabilirsiniz.");
    }
  }, []);

  if (lecture.status === "loading") return <p className="page-header-subtitle">Ders yükleniyor…</p>;
  if (lecture.status === "error") return <Alert tone="critical">{lecture.error}</Alert>;
  if (!lecture.data) return <Alert tone="critical">Ders bulunamadı.</Alert>;

  const l = lecture.data;
  return (
    <div ref={containerRef} className="projector" data-fullscreen={fullscreen ? "true" : "false"}>
      <header className="projector-header">
        <div>
          <h1 className="projector-title">{l.title}</h1>
          <p className="projector-meta">{l.lecturer}</p>
        </div>
        <div className="ui-actions">
          <span className="projector-count" aria-label="Katılan hekim sayısı">
            <span className="mono-num">
              {l.presentCount} / {l.expectedCount}
            </span>{" "}
            katıldı
          </span>
          <Button variant="secondary" size="sm" onClick={toggleFullscreen}>
            {fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
          </Button>
        </div>
      </header>

      {!live || ended ? (
        <div className="projector-ended" role="status">
          <h2>Yoklama kapandı</h2>
          <p>Bu ders için yoklama sona erdi.</p>
        </div>
      ) : (
        <div className="projector-body">
          <div className="projector-code-block">
            <p className="projector-label">Yoklama kodu</p>
            <p className="projector-code mono-num" aria-live="off" data-testid="projector-code">
              {code ? code.code : "······"}
            </p>
            {code && (
              <p className="projector-rotation">
                Yeni kod:{" "}
                <Countdown
                  deadlineMs={code.rotatesAtMs}
                  label="Yeni koda kalan süre"
                  warnAtSeconds={[]}
                  className="projector-countdown"
                />
              </p>
            )}
            {code && (
              <div
                key={code.code}
                className="projector-progress"
                aria-hidden="true"
                style={{ animationDuration: `${Math.max(0, code.rotatesAtMs - Date.now())}ms` }}
              />
            )}
          </div>
          <p className="projector-help">Pediatrist › Ders Yoklaması ekranına bu kodu girin.</p>
        </div>
      )}
      {error && <Alert tone="warning">{error}</Alert>}
      {!wakeLockSupported && live && (
        <p className="projector-meta">Bu tarayıcı ekranı açık tutmayı desteklemiyor; ekran koruyucuyu kapatın.</p>
      )}
    </div>
  );
}
