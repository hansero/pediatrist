"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Alert } from "./Alert";
import { cx } from "./cx";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "start" | "end";
  /** Satırı tanımlayan sütun (ör. ad): `<th scope="row">` olarak çizilir. */
  rowHeader?: boolean;
}

export interface DataTableProps<T> {
  /** Tablonun erişilebilir başlığı (zorunlu). Görsel olarak gizlemek için `captionHidden`. */
  caption: ReactNode;
  captionHidden?: boolean;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Kullanıcıya gösterilecek Türkçe hata (ör. `toUserMessage(err)`). */
  error?: string;
  /** Satır yokken gösterilir (ör. `<EmptyState …/>`). */
  empty?: ReactNode;
}

/**
 * Kap yatay kaydırılabiliyor mu? (dar ekranda geniş tablo). Kaydırılabilirse kap klavyeyle odaklanabilir
 * olmalıdır (WCAG 2.1.1; axe `scrollable-region-focusable`, F8.1); kaydırılamıyorsa gereksiz Tab durağı yok.
 */
function useHorizontalOverflow() {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return; // eski tarayıcı / test ortamı: ilk ölçüm yeterli
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  return { ref, overflowing };
}

/**
 * Veri tablosu: `th scope`, caption, yükleniyor (`aria-busy`), hata ve boş durum.
 * Yükleniyor/hata durumunda eski veya uydurma satır gösterilmez. Dar ekranda yatay kayan tablo, başlığıyla
 * adlandırılmış ve klavyeyle odaklanılıp ok tuşlarıyla kaydırılabilen bir bölgedir.
 */
export function DataTable<T>({
  caption,
  captionHidden,
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  empty,
}: DataTableProps<T>) {
  const alignClass = (c: Column<T>) => (c.align === "end" ? "ui-align-end" : undefined);
  const captionId = useId();
  const scroll = useHorizontalOverflow();
  let body: ReactNode;
  if (loading) {
    body = (
      <tr>
        <td colSpan={columns.length} className="ui-table-state">
          Yükleniyor…
        </td>
      </tr>
    );
  } else if (rows.length === 0 && !error) {
    body = (
      <tr>
        <td colSpan={columns.length} className="ui-table-state">
          {empty ?? "Kayıt yok."}
        </td>
      </tr>
    );
  } else {
    body = rows.map((row) => (
      <tr key={rowKey(row)}>
        {columns.map((c) =>
          c.rowHeader ? (
            <th key={c.key} scope="row" className={alignClass(c)}>
              {c.cell(row)}
            </th>
          ) : (
            <td key={c.key} className={alignClass(c)}>
              {c.cell(row)}
            </td>
          )
        )}
      </tr>
    ));
  }

  return (
    <div className="ui-table">
      {error && <Alert tone="critical">{error}</Alert>}
      {/* Kaydırılabilir bölge deseni: yalnızca taşma varken odaklanabilir ve adlandırılmış. */}
      <div
        ref={scroll.ref}
        className="table-wrap"
        {...(scroll.overflowing ? { tabIndex: 0, role: "region", "aria-labelledby": captionId } : {})}
      >
        <table className="clinical-table" aria-busy={loading || undefined}>
          <caption id={captionId} className={cx("ui-caption", captionHidden && "sr-only")}>
            {caption}
          </caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={alignClass(c)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{error && !loading ? null : body}</tbody>
        </table>
      </div>
    </div>
  );
}
