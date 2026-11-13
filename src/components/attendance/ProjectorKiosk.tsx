"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { isLectureOpen, useLecture } from "@/lib/attendance/live";
import { useIdleExempt } from "@/lib/auth/IdleContext";
import { toAppError } from "@/lib/errors";
import { getProjectorCode } from "@/lib/firebase/callables";

/** Hekimin telefonda açacağı adres: ders ve kod önceden doldurulur (F4.4 kullanır). */
export function checkInUrl(origin: string, sessionId: string, code: string): string {
  const url = new URL("/attendance", origin);
  url.searchParams.set("s", sessionId);
  url.searchParams.set("c", code);
  return url.toString();
}

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
 */
export function ProjectorKiosk({ sessionId }: { sessionId: string }) {
  useIdleExempt();
  const lecture = useLecture(sessionId);
  const [code, setCode] = useState<CodeState | null>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const wakeLockSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  const live = lecture.status === "ready" && isLectureOpen(lecture.data);

  // Kod döngüsü
  useEffect(() => {
    if (!live || ended) return;
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const res = await getProjectorCode({ sessionId });
        if (cancelled) return;
        setError("");
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
  }, [sessionId, live, ended]);

  // QR
  useEffect(() => {
    if (!code) {
      setQr("");
      return;
    }
    let alive = true;
    QRCode.toDataURL(checkInUrl(window.location.origin, sessionId, code.code), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 480,
    }).then((url) => alive && setQr(url));
    return () => {
      alive = false;
    };
  }, [code, sessionId]);

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
          <p className="projector-meta">
            {l.lecturer} · {l.category}
          </p>
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
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="projector-qr"
              src={qr}
              width={480}
              height={480}
              alt="Yoklama için telefonla taranacak QR kod"
            />
          )}
          <p className="projector-help">Pediatrist › Ders Yoklaması ekranında QR kodu okutun ya da kodu girin.</p>
        </div>
      )}
      {error && <Alert tone="warning">{error}</Alert>}
      {!wakeLockSupported && live && (
        <p className="projector-meta">Bu tarayıcı ekranı açık tutmayı desteklemiyor; ekran koruyucuyu kapatın.</p>
      )}
    </div>
  );
}
