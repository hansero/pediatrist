import type { ReactNode } from "react";
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
 * Veri tablosu: `th scope`, caption, yükleniyor (`aria-busy`), hata ve boş durum.
 * Yükleniyor/hata durumunda eski veya uydurma satır gösterilmez.
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
      <div className="table-wrap">
        <table className="clinical-table" aria-busy={loading || undefined}>
          <caption className={cx("ui-caption", captionHidden && "sr-only")}>{caption}</caption>
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
