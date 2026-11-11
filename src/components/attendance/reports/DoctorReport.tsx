"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ATTENDANCE_WARN_RATE } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { useActiveDoctors, type LogItem } from "@/lib/attendance/live";
import {
  buildDoctorReport,
  doctorDetailCsv,
  doctorReportCsv,
  fetchLogs,
  rangeBounds,
  REPORT_LOG_LIMIT,
  residencyLabel,
  useReportQuery,
  type DoctorReportRow,
  type ReportRange,
} from "@/lib/attendance/reports";
import { downloadCsv } from "@/lib/csv";
import { ReportRangeFilter } from "./ReportRangeFilter";
import { RateValue, StatusCell } from "./shared";

const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const thresholdText = `%${Math.round(ATTENDANCE_WARN_RATE * 100)}`;

/**
 * Hekim karnesi (F4.5): seçilen aralıktaki kapanmış derslerde her hekimin katılım sayıları ve oranı,
 * eşik (`ATTENDANCE_WARN_RATE`) altındakiler önce ve işaretli; hekim seçilince ders dökümü. Süren ders
 * orana katılmaz (katılmadı kayıtları kapanışta yazılır, D22).
 */
export function DoctorReport({
  range,
  onRangeChange,
  liveSessionId,
  liveReady,
}: {
  range: ReportRange;
  onRangeChange: (range: ReportRange) => void;
  liveSessionId: string | null;
  liveReady: boolean;
}) {
  const bounds = rangeBounds(range);
  const boundsError = bounds.ok ? undefined : bounds.error;
  const logs = useReportQuery(bounds.ok ? () => fetchLogs(bounds) : null, [range.from, range.to]);
  const doctors = useActiveDoctors();
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const ready = logs.status === "ready" && doctors.status === "ready" && liveReady;
  const rows = useMemo(
    () =>
      logs.data && doctors.data
        ? buildDoctorReport(logs.data.items, doctors.data, { excludeSessionIds: liveSessionId ? [liveSessionId] : [] })
        : [],
    [logs.data, doctors.data, liveSessionId]
  );
  const below = rows.filter((r) => r.belowThreshold);
  const selected = rows.find((r) => r.uid === selectedUid) ?? null;

  const columns: Column<DoctorReportRow>[] = [
    {
      key: "name",
      header: "Hekim",
      rowHeader: true,
      cell: (r) => (
        <>
          {r.name}
          {!r.active && <span className="page-header-subtitle"> (etkin değil)</span>}
        </>
      ),
    },
    { key: "year", header: "Kıdem", cell: (r) => residencyLabel(r.residencyYear) },
    { key: "present", header: "Katıldı", align: "end", cell: (r) => <span className="mono-num">{r.present}</span> },
    { key: "excused", header: "Mazeretli", align: "end", cell: (r) => <span className="mono-num">{r.excused}</span> },
    { key: "absent", header: "Katılmadı", align: "end", cell: (r) => <span className="mono-num">{r.absent}</span> },
    { key: "rate", header: "Katılım oranı", cell: (r) => <RateValue rate={r.rate} /> },
    {
      key: "action",
      header: <span className="sr-only">İşlem</span>,
      align: "end",
      cell: (r) =>
        r.items.length === 0 ? (
          <span className="page-header-subtitle">Ders yok</span>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedUid(r.uid)}
            aria-label={`${r.name}: ders dökümü`}
            aria-pressed={selectedUid === r.uid}
          >
            Ders dökümü
          </Button>
        ),
    },
  ];

  function exportCsv() {
    const csv = doctorReportCsv(rows, range);
    downloadCsv(csv.fileName, csv.headers, csv.rows);
  }

  return (
    <div className="attendance-admin">
      <Card
        title="Hekim karnesi"
        description={`Seçilen aralıkta kapanmış dersler. Oran = katıldı / (katıldı + katılmadı); mazeretliler dahil edilmez. Uyarı eşiği ${thresholdText}.`}
        actions={
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={!ready || rows.length === 0 || Boolean(boundsError)}
            aria-label="Hekim karnesini CSV olarak indir"
          >
            CSV indir
          </Button>
        }
      >
        <div className="auth-stack">
          <ReportRangeFilter
            range={range}
            onChange={onRangeChange}
            onReload={logs.reload}
            error={boundsError}
            reloading={logs.status === "loading"}
          />
          {!boundsError && (
            <>
              {logs.data?.truncated && (
                <Alert tone="warning">
                  Bu aralıkta {REPORT_LOG_LIMIT.toLocaleString("tr-TR")}&apos;den fazla katılım kaydı var; rapor
                  yalnızca en yeni kayıtları içeriyor ve oranlar eksik olabilir. Tarih aralığını daraltın.
                </Alert>
              )}
              {liveSessionId && <p className="page-header-subtitle">Süren ders kapandığında rapora eklenir.</p>}
              {ready &&
                rows.some((r) => r.rate !== null) &&
                (below.length > 0 ? (
                  <Alert tone="warning" title={`${below.length} hekimin katılım oranı ${thresholdText}'in altında`}>
                    {below.map((r) => r.name).join(", ")}
                  </Alert>
                ) : (
                  <Alert tone="success">Bütün hekimlerin katılım oranı {thresholdText} veya üzerinde.</Alert>
                ))}
              <DataTable
                caption="Hekim karnesi"
                captionHidden
                columns={columns}
                rows={ready ? rows : []}
                rowKey={(r) => r.uid}
                loading={!ready && !logs.error && !doctors.error}
                error={logs.error || doctors.error}
                empty={<EmptyState title="Bu aralıkta hekim veya ders kaydı yok" />}
              />
            </>
          )}
        </div>
      </Card>
      {!boundsError && ready && selected && (
        <DoctorDetail row={selected} range={range} onClose={() => setSelectedUid(null)} />
      )}
    </div>
  );
}

function DoctorDetail({ row, range, onClose }: { row: DoctorReportRow; range: ReportRange; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Seçim değişince odak ayrıntıya taşınır (ekran okuyucu ve klavye kullanıcısı yeni içeriği bulur).
  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [row.uid]);

  const columns: Column<LogItem>[] = [
    { key: "date", header: "Tarih", cell: (i) => (i.startedAtMs ? dateTimeFormat.format(i.startedAtMs) : "—") },
    { key: "title", header: "Ders", rowHeader: true, cell: (i) => i.title },
    { key: "lecturer", header: "Eğitici", cell: (i) => i.lecturer },
    { key: "status", header: "Durum", cell: (i) => <StatusCell status={i.status} /> },
    { key: "note", header: "Mazeret notu", cell: (i) => i.excuseNote ?? "—" },
  ];

  function exportCsv() {
    const csv = doctorDetailCsv(row, range);
    downloadCsv(csv.fileName, csv.headers, csv.rows);
  }

  return (
    <div ref={ref} tabIndex={-1} className="report-detail">
      <Card
        title={`${row.name}: ders dökümü`}
        description={`${row.present} katıldı · ${row.excused} mazeretli · ${row.absent} katılmadı`}
        actions={
          <div className="ui-actions">
            <Button variant="secondary" onClick={exportCsv} aria-label={`${row.name} dökümünü CSV olarak indir`}>
              CSV indir
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Kapat
            </Button>
          </div>
        }
      >
        <DataTable
          caption={`${row.name}: ders dökümü`}
          captionHidden
          columns={columns}
          rows={row.items}
          rowKey={(i) => i.sessionId}
          empty={<EmptyState title="Bu aralıkta ders yok" />}
        />
      </Card>
    </div>
  );
}
