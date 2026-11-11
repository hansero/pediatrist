"use client";

import { useState } from "react";
import type { QuizStatus } from "@shared/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { closeQuiz, deleteQuizDraft } from "@/lib/firebase/callables";
import { QUIZ_STATUS_LABEL, REVEAL_POLICY_LABEL, useQuizzes, type QuizSummary } from "@/lib/quiz/admin";
import { EditDraftDialog, PublishDialog } from "./QuizDialogs";

const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const time = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });
const fmt = (ms: number | null) => (ms ? dateTime.format(ms) : "—");
const statusTone = (s: QuizStatus) => (s === "published" ? "success" : s === "closed" ? undefined : "info");

type Filter = "all" | QuizStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "draft", label: "Taslak" },
  { id: "published", label: "Yayında" },
  { id: "closed", label: "Kapalı" },
];

/** Sınavlar (F5.2): canlı liste, duruma göre süzme; yayınla / kapat / düzenle / sil (hepsi sunucu onaylı). */
export function QuizList({ onCreate }: { onCreate: () => void }) {
  const toast = useToast();
  const quizzes = useQuizzes();
  const [filter, setFilter] = useState<Filter>("all");
  const [publishing, setPublishing] = useState<QuizSummary | null>(null);
  const [editing, setEditing] = useState<QuizSummary | null>(null);
  const [closing, setClosing] = useState<QuizSummary | null>(null);
  const [deleting, setDeleting] = useState<QuizSummary | null>(null);

  const all = quizzes.data ?? [];
  const live = all.find((q) => q.status === "published") ?? null;
  const rows = filter === "all" ? all : all.filter((q) => q.status === filter);

  const columns: Column<QuizSummary>[] = [
    { key: "title", header: "Sınav", rowHeader: true, cell: (q) => q.title },
    {
      key: "status",
      header: "Durum",
      cell: (q) => <StatusChip tone={statusTone(q.status)}>{QUIZ_STATUS_LABEL[q.status]}</StatusChip>,
    },
    {
      key: "questions",
      header: "Soru",
      align: "end",
      cell: (q) => <span className="mono-num">{q.questionCount}</span>,
    },
    {
      key: "duration",
      header: "Süre",
      align: "end",
      cell: (q) => <span className="mono-num nowrap">{q.durationMinutes} dk</span>,
    },
    { key: "reveal", header: "Sonuç gösterimi", cell: (q) => REVEAL_POLICY_LABEL[q.revealPolicy] },
    {
      key: "attempts",
      header: "Katılım",
      align: "end",
      cell: (q) => <span className="mono-num">{q.attemptCount}</span>,
    },
    {
      key: "dates",
      header: "Tarih",
      cell: (q) =>
        q.status === "closed"
          ? `Kapandı: ${fmt(q.closedAtMs)}`
          : q.status === "published"
            ? `Kapanış: ${q.closesAtMs ? fmt(q.closesAtMs) : "elle"}`
            : `Oluşturuldu: ${fmt(q.createdAtMs)}`,
    },
    {
      key: "actions",
      header: <span className="sr-only">İşlemler</span>,
      align: "end",
      cell: (q) =>
        q.status === "draft" ? (
          <span className="ui-actions table-actions">
            <Button size="sm" onClick={() => setPublishing(q)} aria-label={`${q.title}: yayınla`}>
              Yayınla
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(q)} aria-label={`${q.title}: düzenle`}>
              Düzenle
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeleting(q)} aria-label={`${q.title}: sil`}>
              Sil
            </Button>
          </span>
        ) : q.status === "published" ? (
          <Button size="sm" variant="danger" onClick={() => setClosing(q)} aria-label={`${q.title}: kapat`}>
            Kapat
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="attendance-admin">
      {quizzes.status === "error" && <Alert tone="critical">{quizzes.error}</Alert>}
      {live && (
        <Card
          title={live.title}
          description={`${live.questionCount} soru · ${live.durationMinutes} dk · Sonuç: ${REVEAL_POLICY_LABEL[live.revealPolicy]}`}
          actions={<StatusChip tone="success">Yayında</StatusChip>}
        >
          <dl className="lecture-stats" aria-label="Yayındaki sınav">
            <div>
              <dt>Katılım</dt>
              <dd className="mono-num">{live.attemptCount}</dd>
            </div>
            <div>
              <dt>Yayın</dt>
              <dd className="stat-text">{fmt(live.publishedAtMs)}</dd>
            </div>
            <div>
              <dt>Kapanış</dt>
              <dd className="stat-text">{live.closesAtMs ? fmt(live.closesAtMs) : "Elle kapatılır"}</dd>
            </div>
          </dl>
          <div className="ui-actions">
            <Button variant="danger" onClick={() => setClosing(live)}>
              Sınavı kapat
            </Button>
          </div>
        </Card>
      )}

      <Card
        title="Sınavlar"
        description="Taslaklar hekimlere görünmez. Aynı anda tek sınav yayında olabilir."
        actions={<Button onClick={onCreate}>Yeni sınav</Button>}
      >
        <div className="auth-stack">
          <div role="group" aria-label="Duruma göre süz" className="mode-switcher">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`mode-btn${filter === f.id ? " active" : ""}`}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                {f.id !== "all" && ` (${all.filter((q) => q.status === f.id).length})`}
              </button>
            ))}
          </div>
          <DataTable
            caption="Sınav listesi"
            captionHidden
            columns={columns}
            rows={rows}
            rowKey={(q) => q.id}
            loading={quizzes.status === "loading"}
            error={quizzes.error}
            empty={
              <EmptyState
                title={
                  filter === "all" ? "Henüz sınav yok" : `${FILTERS.find((f) => f.id === filter)?.label} sınav yok`
                }
                description="CSV ile yeni bir sınav oluşturun."
              />
            }
          />
        </div>
      </Card>

      <PublishDialog quiz={publishing} onClose={() => setPublishing(null)} />
      <EditDraftDialog quiz={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={closing !== null}
        onClose={() => setClosing(null)}
        title="Sınavı kapat"
        description={`"${closing?.title ?? ""}" için yeni giriş alınmaz ve sorular arşive taşınır. Sınavdaki hekimler süreleri dolana kadar teslim edebilir.`}
        confirmLabel="Sınavı kapat"
        pendingLabel="Kapatılıyor…"
        tone="danger"
        onConfirm={async () => {
          if (!closing) return;
          const res = await closeQuiz({ quizId: closing.id });
          const reveal =
            closing.revealPolicy === "after_close"
              ? ` Doğru cevaplar ${time.format(res.revealAtMs)} itibarıyla açılır.`
              : "";
          const ongoing = res.inProgressCount
            ? ` ${res.inProgressCount} hekim süresi dolana kadar devam edebilir.`
            : "";
          toast.show(`Sınav kapatıldı.${ongoing}${reveal}`, { tone: "success" });
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Taslağı sil"
        description={`"${deleting?.title ?? ""}" ve ${deleting?.questionCount ?? 0} sorusu kalıcı olarak silinir. Bu işlem geri alınamaz.`}
        confirmLabel="Taslağı sil"
        pendingLabel="Siliniyor…"
        tone="danger"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteQuizDraft({ quizId: deleting.id });
          toast.show("Taslak silindi.", { tone: "success" });
        }}
      />
    </div>
  );
}
