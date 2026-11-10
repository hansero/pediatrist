import type { ReactNode } from "react";
import { cx, type Tone } from "./cx";

export interface StatusChipProps {
  /** Verilmezse nötr. Renkler YALNIZCA durum için kullanılır (etiket/başlık süsü olarak değil). */
  tone?: Tone;
  /** Sayısal içerik (tabular rakam). */
  numeric?: boolean;
  children: ReactNode;
  className?: string;
}

export function StatusChip({ tone, numeric, children, className }: StatusChipProps) {
  return <span className={cx("sec-chip", tone, numeric && "mono-num", className)}>{children}</span>;
}
