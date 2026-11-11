"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useReportQuery } from "@/lib/attendance/reports";
import { getAttemptReport } from "@/lib/firebase/callables";
import {
  ATTEMPT_QUERY_LIMIT,
  fetchRecentAttempts,
  groupByDoctor,
  type AttemptRow,
  type DoctorProgressRow,
} from "@/lib/quiz/analytics";
import { AttemptReport, type ReportData } from "../report/AttemptReport";
import { ScoreTrend } from "../ScoreTrend";

const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

/**
 * Admin: hekim gelişimi (F5.4). Bütün sınavlardaki teslimler hekim KİMLİĞİNE göre gruplanır; en düşük
 * ortalama üstte. Hekim seçilince puan grafiği + teslim listesi + karne.
 */
export function DoctorProgress() {
  const attempts = useReportQuery(() => fetchRecentAttempts(), []);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [report, setReport] = useState<{ title: string; data: ReportData } | null>(null);
  const open = useAsyncAction(async (row: AttemptRow) => {
    const data = await getAttemptReport({ attemptId: row.attemptId });
    setReport({ title: `${row.doctorName}: ${row.quizTitle}`, data });
    return data;
  });
  const detailRef = useRef<HTMLDivElement>(null);

  const groups = attempts.data ? groupByDoctor(attempts.data.rows) : [];
  const selected = groups.find((g) => g.uid === selectedUid) ?? null;

  useEffect(() => {
    if (selectedUid) detailRef.current?.focus();
  }, [selectedUid]);

  if (report) {
    return (
      <div className="attendance-admin">
        <div className="ui-actions">
          <Button variant="secondary" onClick={() => setReport(null)}>
            Hekime dön
          </Button>
        </div>
        <AttemptReport title={report.title} report={report.data} />
      </div>
    );
  }

  const columns: Column<DoctorProgressRow>[] = [
    { key: "name", header: "Hekim", rowHeader: true, cell: (g) => g.name },
    { key: "year", header: "Kıdem", cell: (g) => (g.residencyYear ? `${g.residencyYear}. yıl` : "Uzman") },
    { key: "count", header: "Sınav", align: "end", cell: (g) => <span className="mono-num">{g.count}</span> },
    { key: "avg", header: "Ortalama", align: "end", cell: (g) => <span className="mono-num">{g.average ?? "—"}</span> },
    {
      key: "latest",
      header: "Son puan",
      align: "end",
      cell: (g) => <span className="mono-num">{g.latest ?? "—"}</span>,
    },
    {
      key: "action",
      header: <span className="sr-only">İşlem</span>,
      align: "end",
      cell: (g) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setSelectedUid(g.uid)}
          aria-label={`${g.name}: gelişim`}
          aria-pressed={selectedUid === g.uid}
        >
          Gelişim
        </Button>
      ),
    },
  ];

  return (
    <div className="attendance-admin">
      <Card title="Hekim gelişimi" description="Bütün sınavlardaki teslimler; en düşük ortalama üstte.">
        {attempts.data?.truncated && (
          <Alert tone="warning">Yalnızca en yeni {ATTEMPT_QUERY_LIMIT} teslim hesaba katıldı.</Alert>
        )}
        {open.error && <Alert tone="critical">{open.error}</Alert>}
        <DataTable
          caption="Hekim gelişimi"
          captionHidden
          columns={columns}
          rows={groups}
          rowKey={(g) => g.uid}
          loading={attempts.status === "loading"}
          error={attempts.error}
          empty={<EmptyState title="Henüz teslim edilmiş sınav yok" />}
        />
      </Card>

      {selected && (
        <div ref={detailRef} tabIndex={-1} className="report-detail">
          <Card
            title={`${selected.name}: puan gelişimi`}
            description={`${selected.count} sınav · ortalama ${selected.average} · en yüksek ${selected.best}`}
            actions={
              <Button variant="secondary" onClick={() => setSelectedUid(null)}>
                Kapat
              </Button>
            }
          >
            <div className="auth-stack">
              <ScoreTrend
                label={`${selected.name} puan gelişimi`}
                points={selected.attempts.map((a) => ({
                  id: a.attemptId,
                  label: a.quizTitle,
                  atMs: a.submittedAtMs,
                  score: a.score,
                  detail: `${a.correctCount}/${a.totalQuestions} doğru`,
                }))}
              />
              <DataTable<AttemptRow>
                caption={`${selected.name}: teslimler`}
                captionHidden
                columns={[
                  { key: "date", header: "Teslim", cell: (a) => dateTime.format(a.submittedAtMs) },
                  { key: "quiz", header: "Sınav", rowHeader: true, cell: (a) => a.quizTitle },
                  {
                    key: "score",
                    header: "Puan",
                    align: "end",
                    cell: (a) => (
                      <span className="mono-num">
                        {a.score} ({a.correctCount}/{a.totalQuestions})
                      </span>
                    ),
                  },
                  {
                    key: "action",
                    header: <span className="sr-only">İşlem</span>,
                    align: "end",
                    cell: (a) => (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void open.run(a)}
                        aria-label={`${a.quizTitle}: karne`}
                      >
                        Karne
                      </Button>
                    ),
                  },
                ]}
                rows={selected.attempts}
                rowKey={(a) => a.attemptId}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
