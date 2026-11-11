"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { toUserMessage } from "@/lib/errors";
import { drawWatermark } from "./watermark";

/** pdf.js varlıkları `public/pdfjs/` altında (scripts/copy-pdfjs-assets.mjs; postinstall/prebuild). */
const WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";
const STANDARD_FONTS = "/pdfjs/standard_fonts/";

async function loadPdf(url: string) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
  // WebAssembly kapalı: CSP 'wasm-unsafe-eval' içermiyor; JPEG2000 dışında gerekmez (JS yedeği kullanılır).
  return pdfjs.getDocument({ url, standardFontDataUrl: STANDARD_FONTS, useWasm: false });
}

/**
 * PDF görüntüleyici (F6.3): sayfalar pdf.js ile canvas'a çizilir ve filigran AYNI canvas'a yakılır (ekran
 * görüntüsünde de kalır). Seçilebilir metin katmanı yoktur (kopyalamayı caydırır); ekran okuyucu için sayfa
 * metni görünmez bir bölgede verilir (erişilebilirlik caydırıcılıktan önce gelir, D11).
 */
export function PdfViewer({
  url,
  title,
  watermark,
  initialPage,
  onPage,
}: {
  url: string;
  title: string;
  watermark: string;
  initialPage: number;
  /** Gösterilen sayfa ve toplam sayfa (ilerleme ve "tamamlandı" için). */
  onPage: (page: number, pageCount: number) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [pageText, setPageText] = useState("");
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | null = null;
    loadPdf(url)
      .then((task) => {
        destroy = () => task.destroy();
        if (cancelled) return void task.destroy();
        return task.promise.then((doc) => !cancelled && setPdf(doc));
      })
      .catch((err: unknown) => !cancelled && setError(`PDF açılamadı. ${toUserMessage(err)}`));
    return () => {
      cancelled = true;
      void destroy?.();
    };
  }, [url]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageCount = pdf?.numPages ?? 0;
  const current = pdf ? Math.min(page, pageCount) : page;

  // Çizimler sıralıdır: pdf.js aynı canvas'ta eşzamanlı iki render'a izin vermez. Genişlik değişince (ör. kaydırma
  // çubuğu belirince) önceki çizim iptal edilir ve BİTMESİ beklenerek yenisi başlar; iptal edilen çizimin hatası
  // yok sayılır (F6.3: telefonda e2e bu yarışı yakaladı).
  const renderChain = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!pdf || !canvasRef.current || width === 0) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    setRendering(true);
    const previous = renderChain.current;
    const run = (async () => {
      await previous;
      if (cancelled) return;
      const p = await pdf.getPage(current);
      if (cancelled) return;
      const base = p.getViewport({ scale: 1 });
      const dpr = window.devicePixelRatio || 1;
      const viewport = p.getViewport({ scale: (width / base.width) * dpr });
      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
      task = p.render({ canvas, viewport });
      await task.promise;
      if (cancelled) return;
      drawWatermark(canvas.getContext("2d")!, canvas.width, canvas.height, watermark, dpr);
      const text = await p.getTextContent();
      if (!cancelled) {
        setPageText(
          text.items
            .map((i) => ("str" in i ? i.str : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
        );
        onPage(current, pdf.numPages);
      }
    })();
    renderChain.current = run.catch(() => undefined);
    run
      .catch((err: unknown) => {
        if (!cancelled) setError(`Sayfa çizilemedi. ${toUserMessage(err)}`);
      })
      .finally(() => !cancelled && setRendering(false));
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, current, width, watermark, onPage]);

  const go = useCallback((n: number) => setPage(Math.max(1, Math.min(pageCount || 1, n))), [pageCount]);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight" || e.key === "PageDown") go(current + 1);
    else if (e.key === "ArrowLeft" || e.key === "PageUp") go(current - 1);
    else if (e.key === "Home") go(1);
    else if (e.key === "End") go(pageCount);
    else return;
    e.preventDefault();
  }

  if (error) return <Alert tone="critical">{error}</Alert>;

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <Button variant="secondary" size="sm" onClick={() => go(current - 1)} disabled={!pdf || current <= 1}>
          Önceki sayfa
        </Button>
        <span className="mono-num" aria-live="polite">
          {pdf ? `Sayfa ${current} / ${pageCount}` : "PDF yükleniyor…"}
        </span>
        <Button variant="secondary" size="sm" onClick={() => go(current + 1)} disabled={!pdf || current >= pageCount}>
          Sonraki sayfa
        </Button>
      </div>
      {/* Klavye: ←/→, PageUp/PageDown, Home/End. Kopyalama ve sağ tık caydırılır (gerçek koruma değil, D11). */}
      {/* Odaklanabilir sayfa bölgesi: klavyeyle sayfa çevirme (WAI-ARIA odaklanabilir bölge deseni). */}
      {/* eslint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={boxRef}
        className="pdf-page"
        tabIndex={0}
        role="region"
        aria-label={`${title}, sayfa ${current}`}
        aria-busy={rendering}
        onKeyDown={onKey}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} aria-hidden="true" />
        <p className="sr-only">{pageText || "Bu sayfada okunabilir metin yok."}</p>
      </div>
      {/* eslint-enable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */}
    </div>
  );
}
