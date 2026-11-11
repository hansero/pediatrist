"use client";

import { useMemo, useState } from "react";
import { ATTENDANCE_WARN_RATE } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { useLectureRecords, type Lecture } from "@/lib/attendance/live";
import {
  buildLectureReport,
  fetchClosedLectures,
  isBelowThreshold,
  lectureReportCsv,
  rangeBounds,
  REPORT_LECTURE_LIMIT,
  residencyLabel,
  useReportQuery,
  type LectureReportRow,
  type ReportRange,
} from "@/lib/attendance/reports";
import { downloadCsv } from "@/lib/csv";
import { ExcuseDialog, type ExcuseTarget } from "../admin/ExcuseDialog";
import { ReportRangeFilter } from "./ReportRangeFilter";
import { RateValue, StatusCell } from "./shared";

const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const timeFormat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

/**
 * Ders raporu (F4.5): seçilen kapanmış dersin bütün kayıtları (D22 ile eksiksiz), özet, sonradan mazeret ve
 * CSV. Kayıtlar canlı dinlenir: mazeret girilince özet ve oran hemen güncellenir.
 */
export function LectureReport({
  range,
  onRangeChange,
}: {
  range: ReportRange;
  onRangeChange: (range: ReportRange) => void;
}) {
  const bounds = rangeBounds(range);
  const boundsError = bounds.ok ? undefined : bounds.error;
  const lectures = useReportQuery(bounds.ok ? () => fetchClosedLectures(bounds) : null, [range.from, range.to]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = lectures.data?.items ?? [];
  const selected = items.find((l) => l.id === selectedId) ?? items[0] ?? null;

  return (
    <div className="attendance-admin">
      <Card
        title="Ders raporu"
        description="Kapanmış derslerin katılım dökümü. Mazeretliler katılım oranına dahil edilmez."
      >
        <div className="auth-stack">
          <ReportRangeFilter
            range={range}
            onChange={onRangeChange}
            onReload={lectures.reload}
            error={boundsError}
            reloading={lectures.status === "loading"}
          />
          {!boundsError && (
            <>
              {lectures.status === "error" && <Alert tone="critical">{lectures.error}</Alert>}
              {lectures.status === "loading" && <p className="page-header-subtitle">Dersler yükleniyor…</p>}
              {lectures.data?.truncated && (
                <Alert tone="warning">
                  Bu aralıkta {REPORT_LECTURE_LIMIT}&apos;den fazla ders var; yalnızca en yeni {REPORT_LECTURE_LIMIT}{" "}
                  ders listelendi. Eski dersler için tarih aralığını daraltın.
                </Alert>
              )}
              {lectures.status === "ready" && items.length === 0 && (
                <EmptyState title="Bu tarih aralığında kapanmış ders yok" description="Tarih aralığını genişletin." />
              )}
              {selected && (
                <Field label="Ders" hint={`${items.length} kapanmış ders (yeniden eskiye).`}>
                  {(p) => (
                    <select
                      {...p}
                      className="form-select"
                      value={selected.id}
                      onChange={(e) => setSelectedId(e.target.value)}
                    >
                      {items.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.startedAtMs ? dateTimeFormat.format(l.startedAtMs) : "—"} · {l.title}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}
            </>
          )}
        </div>
      </Card>
      {!boundsError && selected && <LectureDetail key={selected.id} lecture={selected} />}
    </div>
  );
}

function LectureDetail({ lecture }: { lecture: Lecture }) {
  const records = useLectureRecords(lecture.id);
  const report = useMemo(() => buildLectureReport(lecture, records.data ?? []), [lecture, records.data]);
  const [excusing, setExcusing] = useState<ExcuseTarget | null>(null);
  const { summary } = report;
  const below = isBelowThreshold(summary.rate);

  const columns: Column<LectureReportRow>[] = [
    { key: "name", header: "Hekim", rowHeader: true, cell: (r) => r.name },
    { key: "year", header: "Kıdem", cell: (r) => residencyLabel(r.residencyYear) },
    { key: "status", header: "Durum", cell: (r) => <StatusCell status={r.status} /> },
    {
      key: "time",
      header: "Katılım saati",
      cell: (r) => (r.status === "present" && r.verifiedAtMs ? timeFormat.format(r.verifiedAtMs) : "—"),
    },
    { key: "note", header: "Mazeret notu", cell: (r) => r.excuseNote ?? "—" },
    {
      key: "action",
      header: <span className="sr-only">İşlem</span>,
      align: "end",
      cell: (r) =>
        r.status === "present" ? null : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setExcusing({ uid: r.uid, name: r.name, excuseNote: r.excuseNote })}
            aria-label={`${r.name}: ${r.status === "excused" ? "mazereti düzenle" : "mazeret gir"}`}
          >
            {r.status === "excused" ? "Mazereti düzenle" : "Mazeret gir"}
          </Button>
        ),
    },
  ];

  function exportCsv() {
    const csv = lectureReportCsv(lecture, report);
    downloadCsv(csv.fileName, csv.headers, csv.rows);
  }

  return (
    <Card
      title={lecture.title}
      description={`${lecture.startedAtMs ? dateTimeFormat.format(lecture.startedAtMs) : "—"} · ${lecture.lecturer} · ${lecture.category}`}
      actions={
        <Button
          variant="secondary"
          onClick={exportCsv}
          disabled={records.status !== "ready" || report.rows.length === 0}
          aria-label="Ders raporunu CSV olarak indir"
        >
          CSV indir
        </Button>
      }
    >
      <div className="auth-stack">
        <dl className="lecture-stats" aria-label="Ders özeti">
          <div>
            <dt>Beklenen</dt>
            <dd className="mono-num">{summary.expected}</dd>
          </div>
          <div>
            <dt>Katıldı</dt>
            <dd className="mono-num">{records.status === "ready" ? summary.present : "…"}</dd>
          </div>
          <div>
            <dt>Mazeretli</dt>
            <dd className="mono-num">{records.status === "ready" ? summary.excused : "…"}</dd>
          </div>
          <div>
            <dt>Katılmadı</dt>
            <dd className="mono-num">{records.status === "ready" ? summary.absent : "…"}</dd>
          </div>
          <div>
            <dt>Katılım oranı</dt>
            <dd>{records.status === "ready" ? <RateValue rate={summary.rate} /> : "…"}</dd>
          </div>
        </dl>
        {records.status === "ready" && below && (
          <Alert tone="warning">
            Bu dersin katılım oranı %{Math.round(ATTENDANCE_WARN_RATE * 100)} eşiğinin altında.
          </Alert>
        )}
        <DataTable
          caption={`${lecture.title}: katılım dökümü`}
          captionHidden
          columns={columns}
          rows={report.rows}
          rowKey={(r) => r.uid}
          loading={records.status === "loading"}
          error={records.error}
          empty={<EmptyState title="Bu ders için kayıt yok" />}
        />
      </div>
      <ExcuseDialog sessionId={lecture.id} target={excusing} onClose={() => setExcusing(null)} />
    </Card>
  );
}
