"use client";

import { useState } from "react";
import { RESIDENCY_YEARS } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useReportQuery } from "@/lib/attendance/reports";
import { downloadCsv } from "@/lib/csv";
import { getAttemptReport } from "@/lib/firebase/callables";
import { QUIZ_STATUS_LABEL, useQuizzes } from "@/lib/quiz/admin";
import {
  ATTEMPT_QUERY_LIMIT,
  attemptsCsv,
  fetchQuizAttempts,
  filterAttempts,
  questionStats,
  submissionKind,
  SUBMISSION_LABEL,
  summarizeScores,
  type AttemptRow,
  type SubmissionKind,
} from "@/lib/quiz/analytics";
import { AttemptReport, type ReportData } from "../report/AttemptReport";

const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const percent = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
const PAGE = 50;

type YearFilter = number | "all" | "specialist";

/** Admin: sınav sonuçları (F5.4). Sunucu puanlamasının sonuçları; karne `getAttemptReport` ile (admin'e tam). */
export function QuizResults() {
  const quizzes = useQuizzes();
  const options = (quizzes.data ?? []).filter((q) => q.status !== "draft");
  const [quizId, setQuizId] = useState<string | null>(null);
  const selected = options.find((q) => q.id === quizId) ?? options[0] ?? null;
  const attempts = useReportQuery(selected ? () => fetchQuizAttempts(selected.id) : null, [selected?.id]);
  const [year, setYear] = useState<YearFilter>("all");
  const [kind, setKind] = useState<SubmissionKind>("all");
  const [visible, setVisible] = useState(PAGE);
  const [report, setReport] = useState<{ title: string; data: ReportData } | null>(null);
  const open = useAsyncAction(async (row: AttemptRow) => {
    const data = await getAttemptReport({ attemptId: row.attemptId });
    setReport({ title: `${row.doctorName}: ${row.quizTitle}`, data });
    return data;
  });

  const all = attempts.data?.rows ?? [];
  const rows = filterAttempts(all, { year, kind });
  const summary = summarizeScores(rows);
  const stats = questionStats(rows);
  const inProgress = selected ? Math.max(0, selected.attemptCount - all.length) : 0;

  if (report) {
    return (
      <div className="attendance-admin">
        <div className="ui-actions">
          <Button variant="secondary" onClick={() => setReport(null)}>
            Sonuçlara dön
          </Button>
        </div>
        <AttemptReport title={report.title} report={report.data} />
      </div>
    );
  }

  const columns: Column<AttemptRow>[] = [
    { key: "name", header: "Hekim", rowHeader: true, cell: (r) => r.doctorName },
    { key: "year", header: "Kıdem", cell: (r) => (r.residencyYear ? `${r.residencyYear}. yıl` : "Uzman") },
    {
      key: "score",
      header: "Puan",
      align: "end",
      cell: (r) => (
        <span className="mono-num">
          {r.score} ({r.correctCount}/{r.totalQuestions})
        </span>
      ),
    },
    { key: "date", header: "Teslim", cell: (r) => dateTime.format(r.submittedAtMs) },
    {
      key: "kind",
      header: "Teslim türü",
      cell: (r) => {
        const k = submissionKind(r);
        return <StatusChip tone={k === "normal" ? undefined : "warning"}>{SUBMISSION_LABEL[k]}</StatusChip>;
      },
    },
    {
      key: "tabs",
      header: "Sekme değişimi",
      align: "end",
      cell: (r) => <span className="mono-num">{r.tabSwitchCount}</span>,
    },
    {
      key: "action",
      header: <span className="sr-only">İşlem</span>,
      align: "end",
      cell: (r) => (
        <Button size="sm" variant="secondary" onClick={() => void open.run(r)} aria-label={`${r.doctorName}: karne`}>
          Karne
        </Button>
      ),
    },
  ];

  return (
    <div className="attendance-admin">
      <Card
        title="Sınav sonuçları"
        description="Puanlama sunucuda yapılır. Hekim kimliğine göre listelenir; sekme değişimi bilgi amaçlıdır."
        actions={
          <Button
            variant="secondary"
            disabled={!selected || rows.length === 0}
            onClick={() => {
              if (!selected) return;
              const csv = attemptsCsv(selected.title, rows);
              downloadCsv(csv.fileName, csv.headers, csv.rows);
            }}
            aria-label="Sınav sonuçlarını CSV olarak indir"
          >
            CSV indir
          </Button>
        }
      >
        <div className="auth-stack">
          {quizzes.error && <Alert tone="critical">{quizzes.error}</Alert>}
          {quizzes.status === "ready" && options.length === 0 ? (
            <EmptyState title="Henüz yayınlanmış sınav yok" />
          ) : (
            <div className="report-filter">
              <Field label="Sınav">
                {(p) => (
                  <select
                    {...p}
                    className="form-select"
                    value={selected?.id ?? ""}
                    onChange={(e) => {
                      setQuizId(e.target.value);
                      setVisible(PAGE);
                    }}
                  >
                    {options.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} ({QUIZ_STATUS_LABEL[q.status].toLocaleLowerCase("tr")})
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Kıdem">
                {(p) => (
                  <select
                    {...p}
                    className="form-select"
                    value={String(year)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setYear(v === "all" || v === "specialist" ? v : Number(v));
                    }}
                  >
                    <option value="all">Tümü</option>
                    {RESIDENCY_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}. yıl
                      </option>
                    ))}
                    <option value="specialist">Uzman</option>
                  </select>
                )}
              </Field>
              <Field label="Teslim türü">
                {(p) => (
                  <select
                    {...p}
                    className="form-select"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as SubmissionKind)}
                  >
                    <option value="all">Tümü</option>
                    <option value="normal">Zamanında</option>
                    <option value="late">Geç</option>
                    <option value="auto">Otomatik</option>
                  </select>
                )}
              </Field>
            </div>
          )}
          {attempts.error && <Alert tone="critical">{attempts.error}</Alert>}
          {open.error && <Alert tone="critical">{open.error}</Alert>}
          {attempts.data?.truncated && (
            <Alert tone="warning">Yalnızca en yeni {ATTEMPT_QUERY_LIMIT} teslim gösteriliyor.</Alert>
          )}
          {selected && attempts.status === "ready" && (
            <dl className="lecture-stats" aria-label="Sınav özeti">
              <div>
                <dt>Teslim</dt>
                <dd className="mono-num">{summary.count}</dd>
              </div>
              <div>
                <dt>Ortalama</dt>
                <dd className="mono-num">{summary.average ?? "—"}</dd>
              </div>
              <div>
                <dt>Medyan</dt>
                <dd className="mono-num">{summary.median ?? "—"}</dd>
              </div>
              <div>
                <dt>Sınavda</dt>
                <dd className="mono-num">{inProgress}</dd>
              </div>
            </dl>
          )}
        </div>
      </Card>

      {selected && stats.length > 0 && (
        <Card
          title="Soru bazında doğru oranı"
          description="Düşük oranlı sorular tekrar edilmesi gereken konuları gösterir."
        >
          <ul className="meter-list" aria-label="Soru bazında doğru oranı">
            {stats.map((s) => (
              <li key={s.questionId} className="meter-row">
                <span>Soru {s.orderIndex}</span>
                <span className="meter-track" aria-hidden="true">
                  <span className="meter-fill" style={{ width: `${Math.round(s.rate * 100)}%` }} />
                </span>
                <span className="mono-num">
                  {percent.format(s.rate)} ({s.correct}/{s.answered})
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {selected && (
        <Card
          title="Teslimler"
          description={`${rows.length} teslim${rows.length !== all.length ? ` (süzüldü, toplam ${all.length})` : ""}.`}
        >
          <DataTable
            caption="Sınav teslimleri"
            captionHidden
            columns={columns}
            rows={rows.slice(0, visible)}
            rowKey={(r) => r.attemptId}
            loading={attempts.status === "loading"}
            error={attempts.error}
            empty={<EmptyState title="Bu ölçütlerle teslim yok" />}
          />
          {visible < rows.length && (
            <div className="ui-actions">
              <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
                {Math.min(PAGE, rows.length - visible)} teslim daha göster
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
