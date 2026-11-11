"use client";

import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { summarizeHistory, useMyAttendanceHistory, type HistoryItem } from "@/lib/attendance/live";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const timeFormat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });
const percent = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });

/**
 * Hekimin kişisel katılım geçmişi (F4.4). Ders kapanırken sunucu katılmayan hekime "katılmadı" kaydı yazar
 * (D22); böylece geçmiş eksiksizdir. Mazeretliler katılım oranının paydasına girmez.
 */
export function AttendanceHistory({ uid }: { uid: string }) {
  const history = useMyAttendanceHistory(uid);
  const items = history.data ?? [];
  const summary = summarizeHistory(items);

  const columns: Column<HistoryItem>[] = [
    { key: "date", header: "Tarih", cell: (i) => (i.startedAtMs ? dateFormat.format(i.startedAtMs) : "—") },
    { key: "title", header: "Ders", rowHeader: true, cell: (i) => i.title },
    { key: "lecturer", header: "Eğitici", cell: (i) => i.lecturer },
    {
      key: "status",
      header: "Durum",
      cell: (i) =>
        i.status === "present" ? (
          <StatusChip tone="success">
            Katıldım{i.verifiedAtMs ? ` · ${timeFormat.format(i.verifiedAtMs)}` : ""}
          </StatusChip>
        ) : i.status === "excused" ? (
          <span className="history-excuse">
            <StatusChip tone="warning">Mazeretli</StatusChip>
            {i.excuseNote && <span className="page-header-subtitle">{i.excuseNote}</span>}
          </span>
        ) : (
          <StatusChip tone="critical">Katılmadım</StatusChip>
        ),
    },
  ];

  return (
    <Card title="Katılım geçmişim" description="Son 100 ders. Mazeretli dersler katılım oranına dahil edilmez.">
      {history.status === "ready" && items.length > 0 && (
        <dl className="lecture-stats history-stats">
          <div>
            <dt>Katılım oranı</dt>
            <dd className="mono-num">{summary.rate === null ? "—" : percent.format(summary.rate)}</dd>
          </div>
          <div>
            <dt>Katıldım</dt>
            <dd className="mono-num">{summary.present}</dd>
          </div>
          <div>
            <dt>Mazeretli</dt>
            <dd className="mono-num">{summary.excused}</dd>
          </div>
          <div>
            <dt>Katılmadım</dt>
            <dd className="mono-num">{summary.absent}</dd>
          </div>
        </dl>
      )}
      <DataTable
        caption="Kişisel ders katılım geçmişi"
        captionHidden
        columns={columns}
        rows={items}
        rowKey={(i) => i.sessionId}
        loading={history.status === "loading"}
        error={history.error}
        empty={<EmptyState title="Henüz kapanmış ders yok" description="Katıldığınız dersler burada listelenir." />}
      />
    </Card>
  );
}
