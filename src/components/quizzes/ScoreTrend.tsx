"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export interface TrendPoint {
  id: string;
  label: string;
  atMs: number;
  /** 0–100 */
  score: number;
  detail?: string;
}

const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });
const fullDate = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" });

const HEIGHT = 200;
const PAD = { top: 16, right: 40, bottom: 28, left: 36 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Puan gelişimi (F5.4): tek seri çizgi (0–100, tek eksen), kronolojik. Tek seri olduğu için lejant yok;
 * başlık seriyi adlandırır. Fare: en yakın noktada dikey kılavuz + ipucu. Klavye: grafik odaklanınca ←/→
 * noktalar arasında gezer ve nokta ekran okuyucuya duyurulur. Aynı veri yanında tablo olarak da vardır.
 */
export function ScoreTrend({ points, label }: { points: TrendPoint[]; label: string }) {
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const descId = useId();
  const data = [...points].sort((a, b) => a.atMs - b.atMs);

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (score: number) => PAD.top + innerH - (Math.max(0, Math.min(100, score)) / 100) * innerH;
  const path = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");

  function nearest(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    data.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setActive(best);
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (!data.length) return;
    const last = data.length - 1;
    const next =
      e.key === "ArrowRight"
        ? Math.min(last, (active ?? -1) + 1)
        : e.key === "ArrowLeft"
          ? Math.max(0, (active ?? last + 1) - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  }

  const current = active === null ? null : data[active];
  const summary = data.length
    ? `${label}: ${data.length} sınav, ilk ${data[0].score}, son ${data[data.length - 1].score} puan.`
    : `${label}: veri yok.`;

  return (
    <div ref={boxRef} className="trend">
      {width > 0 && data.length > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={summary}
          aria-describedby={descId}
          tabIndex={0}
          className="trend-svg"
          onPointerMove={nearest}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + innerW} y1={y(v)} y2={y(v)} className="trend-grid" />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="trend-axis">
                {v}
              </text>
            </g>
          ))}
          {data.length > 1 && (
            <>
              <text x={x(0)} y={HEIGHT - 8} textAnchor="start" className="trend-axis">
                {dateFormat.format(data[0].atMs)}
              </text>
              <text x={x(data.length - 1)} y={HEIGHT - 8} textAnchor="end" className="trend-axis">
                {dateFormat.format(data[data.length - 1].atMs)}
              </text>
            </>
          )}
          {current && (
            <line x1={x(active!)} x2={x(active!)} y1={PAD.top} y2={PAD.top + innerH} className="trend-crosshair" />
          )}
          <path d={path} className="trend-line" />
          {data.map((p, i) => (
            <circle key={p.id} cx={x(i)} cy={y(p.score)} r={i === active ? 6 : 4} className="trend-point" />
          ))}
          {/* Son değer çizginin ucunda (metin rengi, seri rengi değil). */}
          <text x={x(data.length - 1) + 10} y={y(data[data.length - 1].score)} dy="0.32em" className="trend-end">
            {data[data.length - 1].score}
          </text>
        </svg>
      )}
      {current && (
        <div
          className="trend-tooltip"
          style={{
            left: Math.min(Math.max(x(active!) - 90, 0), Math.max(0, width - 180)),
            top: Math.max(0, y(current.score) - 78),
          }}
          aria-hidden="true"
        >
          <strong className="mono-num">{current.score} puan</strong>
          <span>{current.label}</span>
          <span className="page-header-subtitle">
            {fullDate.format(current.atMs)}
            {current.detail ? ` · ${current.detail}` : ""}
          </span>
        </div>
      )}
      <p id={descId} className="sr-only" aria-live="polite">
        {current
          ? `${current.label}, ${fullDate.format(current.atMs)}: ${current.score} puan.`
          : "Noktalar arasında sol ve sağ ok tuşlarıyla gezinin. Aynı veriler aşağıdaki tabloda."}
      </p>
    </div>
  );
}
