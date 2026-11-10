"use client";

import type { ButtonHTMLAttributes, MouseEvent, Ref } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { cx } from "./cx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "md" | "sm";
  /** Sunucu işlemi sürüyor: tıklama yok sayılır, `aria-busy` ve döner gösterge. */
  loading?: boolean;
  /** Yüklenirken gösterilecek metin (ör. "Kaydediliyor…"). Verilmezse etiket aynı kalır. */
  loadingText?: string;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Tek buton bileşeni (F3.1).
 * - Varsayılan `type="button"` (form içinde istemeden gönderim yok); gönder butonu `type="submit"` ister.
 * - Hydration tamamlanana kadar gerçekten `disabled` (N3).
 * - `loading` sırasında `disabled` YERİNE `aria-disabled` kullanılır: odak butonda kalır, ekran okuyucu
 *   "meşgul" duyurur, tıklama ve form gönderimi engellenir.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  disabled,
  type = "button",
  className,
  children,
  onClick,
  ref,
  ...rest
}: ButtonProps) {
  const hydrated = useHydrated();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={cx("btn", `btn-${variant}`, size === "sm" && "btn-sm", className)}
      disabled={disabled || !hydrated}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      data-hydrated={hydrated ? "true" : "false"}
      onClick={handleClick}
    >
      {loading && <span className="ui-spinner" aria-hidden="true" />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
