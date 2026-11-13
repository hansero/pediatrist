"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/hooks/useHydrated";
import { parseCheckInLink } from "@/lib/attendance/checkInLink";
import { CAMERA_UNSUPPORTED_MESSAGE, cameraErrorMessage } from "@/lib/errors";

/** Kare örnekleme aralığı ve çözümleme için küçültülen en büyük kenar (telefon işlemcisini yormasın). */
const SCAN_INTERVAL_MS = 200;
const MAX_DECODE_EDGE = 640;

const NOT_OURS = "Bu bir Pediatrist yoklama kodu değil.";
const OTHER_LECTURE = "Bu QR başka bir derse ait. Projektördeki güncel QR'ı okutun.";
const BAD_CODE = "QR okunamadı. Projektördeki güncel QR'ı okutun.";

type JsQr = (typeof import("jsqr"))["default"];

export function cameraSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

/** Arka kamerayı ister; cihaz bu kısıtı karşılayamazsa (`OverconstrainedError`) herhangi bir kamerayla bir kez dener. */
async function openCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
  } catch (err) {
    if ((err as { name?: string })?.name !== "OverconstrainedError") throw err;
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}

/**
 * Uygulama içi QR okuyucu (F11.2, D27). Kamera izni yalnızca "QR kodu okut" düğmesine basınca istenir.
 * Görüntü cihazda `jsqr` ile çözülür; kaydedilmez ve hiçbir yere gönderilmez. Bu uygulamanın bu derse ait
 * yoklama bağlantısı okununca kamera kapanır ve kod `onCode`'a verilir (gönderimi çağıran yapar).
 */
export function QrScanner({
  sessionId,
  onCode,
  disabled = false,
}: {
  sessionId: string;
  onCode: (code: string) => void;
  disabled?: boolean;
}) {
  const hydrated = useHydrated();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCodeRef = useRef(onCode);
  const [phase, setPhase] = useState<"idle" | "starting" | "scanning">("idle");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const stop = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPhase("idle");
    setHint("");
  }, []);

  // Sayfa kapanırken veya arka plana alınınca kamera bırakılır.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      stop();
    };
  }, [stop]);

  const scanLoop = useCallback(
    (jsQR: JsQr) => {
      const tick = () => {
        const video = videoRef.current;
        if (!streamRef.current || !video) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          const scale = Math.min(1, MAX_DECODE_EDGE / Math.max(video.videoWidth, video.videoHeight));
          const w = Math.round(video.videoWidth * scale);
          const h = Math.round(video.videoHeight * scale);
          const canvas = (canvasRef.current ??= document.createElement("canvas"));
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            if (found?.data) {
              const link = parseCheckInLink(found.data, window.location.origin);
              if (link.ok && link.sessionId === sessionId) {
                stop();
                onCodeRef.current(link.code);
                return;
              }
              setHint(link.ok ? OTHER_LECTURE : link.reason === "bad-code" ? BAD_CODE : NOT_OURS);
            }
          }
        }
        timerRef.current = window.setTimeout(tick, SCAN_INTERVAL_MS);
      };
      tick();
    },
    [sessionId, stop]
  );

  async function start() {
    setError("");
    setHint("");
    setPhase("starting");
    try {
      // Çözücü yalnızca okuyucu açılınca yüklenir (sayfa paketini büyütmesin).
      const [stream, jsqr] = await Promise.all([openCamera(), import("jsqr")]);
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setPhase("scanning");
      scanLoop(jsqr.default);
    } catch (err) {
      stop();
      setError(cameraErrorMessage(err));
    }
  }

  if (!hydrated) return null;
  if (!cameraSupported()) return <p className="ui-field-hint">{CAMERA_UNSUPPORTED_MESSAGE}</p>;

  return (
    <div className="qr-scanner">
      {phase === "idle" ? (
        <Button onClick={start} disabled={disabled} className="qr-scanner-start">
          QR kodu okut
        </Button>
      ) : (
        <>
          <div className="qr-scanner-frame">
            <video ref={videoRef} muted playsInline autoPlay aria-label="Kamera görüntüsü" />
          </div>
          <p className="qr-scanner-status" role="status" aria-live="polite">
            {phase === "starting" ? "Kamera açılıyor…" : hint || "QR kod aranıyor… Projektördeki QR'ı çerçeveye alın."}
          </p>
          <Button variant="secondary" size="sm" onClick={stop}>
            Kamerayı kapat
          </Button>
        </>
      )}
      {error && <Alert tone="critical">{error}</Alert>}
    </div>
  );
}
