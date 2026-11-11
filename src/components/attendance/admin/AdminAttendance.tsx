"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { LECTURE_CATEGORIES, LIMITS } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Countdown } from "@/components/ui/Countdown";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import {
  isLectureOpen,
  useActiveDoctors,
  useLectureRecords,
  useLiveLecture,
  useRecentLectures,
  type AttendanceRecordView,
  type Lecture,
  type MemberSummary,
} from "@/lib/attendance/live";
import type { ClinicMemberSession } from "@/lib/auth/types";
import { endLectureSession, markAttendanceExcused, startLectureSession } from "@/lib/firebase/callables";

const timeFormat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

export const projectorPath = (sessionId: string) => `/attendance/projector/${encodeURIComponent(sessionId)}`;

/**
 * Eğitim sorumlusu yoklama ekranı (F4.3). Bütün veriler Firestore'dan canlı okunur; bütün işlemler
 * callable'larla, sonuç beklenerek yapılır (iyimser başarı yok). Ayrıntılı raporlar F4.5.
 */
export function AdminAttendance({ session }: { session: ClinicMemberSession }) {
  const live = useLiveLecture();

  return (
    <div className="attendance-admin">
      {live.status === "error" && <Alert tone="critical">{live.error}</Alert>}
      {live.status === "loading" && <p className="page-header-subtitle">Canlı ders kontrol ediliyor…</p>}
      {live.status === "ready" &&
        (live.data ? <LiveLecturePanel lecture={live.data} /> : <StartLectureForm session={session} />)}
      <RecentLectures />
    </div>
  );
}

// --- Ders başlatma ------------------------------------------------------------------------

function StartLectureForm({ session }: { session: ClinicMemberSession }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [lecturer, setLecturer] = useState(`${session.title} ${session.fullName}`.trim());
  const [category, setCategory] = useState<string>(LECTURE_CATEGORIES[0]);
  const [duration, setDuration] = useState("15");
  const start = useAsyncAction(startLectureSession);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await start.run({ title, lecturer, category, durationMinutes: Number(duration) });
    if (res) {
      toast.show("Ders yoklaması başlatıldı.", { tone: "success" });
      setTitle("");
    }
  }

  return (
    <Card
      title="Ders yoklaması başlat"
      description="Başlattığınız anda projektör kodu üretilir; hekimler kayıtlı telefonlarıyla katılır."
    >
      <form className="auth-stack" onSubmit={onSubmit} noValidate>
        {start.error && <Alert tone="critical">{start.error}</Alert>}
        <Field label="Ders başlığı" required>
          {(p) => (
            <input
              {...p}
              className="form-input"
              maxLength={LIMITS.titleLength}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <div className="grid-2">
          <Field label="Eğitici" required>
            {(p) => (
              <input
                {...p}
                className="form-input"
                maxLength={LIMITS.personNameLength}
                value={lecturer}
                onChange={(e) => setLecturer(e.target.value)}
              />
            )}
          </Field>
          <Field label="Kategori">
            {(p) => (
              <select {...p} className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {LECTURE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field
          label="Yoklama süresi (dakika)"
          hint={`${LIMITS.lectureMinutes.min}–${LIMITS.lectureMinutes.max} dakika. Süre dolunca yoklama kendiliğinden kapanır.`}
          required
        >
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="numeric"
              className="form-input"
              min={LIMITS.lectureMinutes.min}
              max={LIMITS.lectureMinutes.max}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          )}
        </Field>
        <div className="ui-actions">
          <Button type="submit" loading={start.pending} loadingText="Başlatılıyor…">
            Yoklamayı başlat
          </Button>
        </div>
      </form>
    </Card>
  );
}

// --- Canlı ders -------------------------------------------------------------------------

function LiveLecturePanel({ lecture }: { lecture: Lecture }) {
  const toast = useToast();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const open = isLectureOpen(lecture);

  return (
    <>
      <Card
        title={lecture.title}
        description={`${lecture.lecturer} · ${lecture.category}`}
        actions={<StatusChip tone={open ? "success" : "warning"}>{open ? "Yoklama açık" : "Süre doldu"}</StatusChip>}
      >
        <div className="auth-stack">
          <dl className="lecture-stats">
            <div>
              <dt>Katılan</dt>
              <dd className="mono-num" data-testid="present-count">
                {lecture.presentCount} / {lecture.expectedCount}
              </dd>
            </div>
            <div>
              <dt>Mazeretli</dt>
              <dd className="mono-num">{lecture.excusedCount}</dd>
            </div>
            <div>
              <dt>Kalan süre</dt>
              <dd>
                <Countdown
                  deadlineMs={lecture.endsAtMs}
                  label="Yoklamanın kapanmasına kalan süre"
                  warnAtSeconds={[60]}
                />
              </dd>
            </div>
          </dl>
          {!open && (
            <Alert tone="warning">
              Yoklama süresi doldu; birkaç dakika içinde otomatik kapatılır. Hemen kapatmak için dersi bitirin.
            </Alert>
          )}
          <div className="ui-actions">
            <Link href={projectorPath(lecture.id)} className="btn btn-primary" target="_blank" rel="noopener">
              Projektör ekranını aç
            </Link>
            <Button variant="danger" onClick={() => setConfirmEnd(true)}>
              Dersi bitir
            </Button>
          </div>
        </div>
      </Card>
      <LiveRoster lecture={lecture} />
      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="Ders yoklamasını bitir"
        description={`"${lecture.title}" için yoklama kapanır ve projektör kodu geçersiz olur. Sonradan mazeret girilebilir.`}
        confirmLabel="Dersi bitir"
        pendingLabel="Bitiriliyor…"
        onConfirm={async () => {
          await endLectureSession({ sessionId: lecture.id });
          toast.show("Ders yoklaması kapatıldı.", { tone: "success" });
        }}
      />
    </>
  );
}

// --- Canlı katılım listesi ----------------------------------------------------------------

interface RosterRow {
  uid: string;
  name: string;
  residencyYear: number | null;
  hasDevice: boolean | null;
  record: AttendanceRecordView | null;
  expected: boolean;
}

/** Beklenen hekimler (ders başındaki liste) + sonradan katılanlar; kayıt durumu canlı. */
export function buildRoster(
  lecture: Pick<Lecture, "expectedAttendees">,
  doctors: MemberSummary[],
  records: AttendanceRecordView[]
): RosterRow[] {
  const byUid = new Map(doctors.map((d) => [d.uid, d]));
  const recordByUid = new Map(records.map((r) => [r.uid, r]));
  const uids = [...new Set([...lecture.expectedAttendees, ...records.map((r) => r.uid)])];
  const rank = (r: RosterRow) => (r.record?.status === "present" ? 2 : r.record?.status === "excused" ? 1 : 0);
  return uids
    .map((uid) => {
      const d = byUid.get(uid);
      const record = recordByUid.get(uid) ?? null;
      return {
        uid,
        name: d
          ? `${d.title} ${d.fullName}`.trim()
          : record
            ? `${record.title} ${record.fullName}`.trim()
            : "Bilinmeyen üye",
        residencyYear: d?.residencyYear ?? null,
        hasDevice: d ? d.hasDevice : null,
        record,
        expected: lecture.expectedAttendees.includes(uid),
      };
    })
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "tr"));
}

function LiveRoster({ lecture }: { lecture: Lecture }) {
  const records = useLectureRecords(lecture.id);
  const doctors = useActiveDoctors();
  const [excusing, setExcusing] = useState<RosterRow | null>(null);

  const rows = useMemo(
    () =>
      records.status === "ready" && doctors.status === "ready" ? buildRoster(lecture, doctors.data, records.data) : [],
    [lecture, records, doctors]
  );

  const columns: Column<RosterRow>[] = [
    { key: "name", header: "Hekim", rowHeader: true, cell: (r) => r.name },
    { key: "year", header: "Kıdem", cell: (r) => (r.residencyYear ? `${r.residencyYear}. yıl` : "Uzman") },
    {
      key: "status",
      header: "Durum",
      cell: (r) =>
        r.record?.status === "present" ? (
          <StatusChip tone="success">
            Katıldı{r.record.verifiedAtMs ? ` · ${timeFormat.format(r.record.verifiedAtMs)}` : ""}
          </StatusChip>
        ) : r.record?.status === "excused" ? (
          <StatusChip tone="warning">Mazeretli</StatusChip>
        ) : (
          <StatusChip>Bekleniyor</StatusChip>
        ),
    },
    {
      key: "device",
      header: "Yoklama cihazı",
      cell: (r) => (r.hasDevice === null ? "—" : r.hasDevice ? "Kayıtlı" : "Kayıtlı değil"),
    },
    {
      key: "action",
      header: <span className="sr-only">İşlem</span>,
      align: "end",
      cell: (r) =>
        r.record?.status === "present" ? null : (
          <Button variant="secondary" size="sm" onClick={() => setExcusing(r)} aria-label={`${r.name}: mazeret gir`}>
            {r.record?.status === "excused" ? "Mazereti düzenle" : "Mazeret gir"}
          </Button>
        ),
    },
  ];

  return (
    <Card title="Katılım durumu" description="Liste canlı güncellenir.">
      <DataTable
        caption="Canlı ders katılım listesi"
        captionHidden
        columns={columns}
        rows={rows}
        rowKey={(r) => r.uid}
        loading={records.status === "loading" || doctors.status === "loading"}
        error={records.error || doctors.error}
        empty={<EmptyState title="Bu ders için beklenen hekim yok" />}
      />
      <ExcuseDialog sessionId={lecture.id} row={excusing} onClose={() => setExcusing(null)} />
    </Card>
  );
}

function ExcuseDialog({ sessionId, row, onClose }: { sessionId: string; row: RosterRow | null; onClose: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const save = useAsyncAction(markAttendanceExcused);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  function close() {
    if (save.pending) return;
    setNote("");
    save.reset();
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    if (await save.run({ sessionId, targetUid: row.uid, excuseNote: note })) {
      toast.show(`${row.name} mazeretli olarak işaretlendi.`, { tone: "success" });
      close();
    }
  }

  return (
    <Dialog open={row !== null} onClose={close} title="Mazeret gir" description={row?.name} initialFocusRef={noteRef}>
      <form className="auth-stack" onSubmit={onSubmit} noValidate>
        {save.error && <Alert tone="critical">{save.error}</Alert>}
        <Field
          label="Mazeret notu"
          hint={`En fazla ${LIMITS.excuseNoteLength} karakter (ör. nöbet ertesi, yıllık izin).`}
        >
          {(p) => (
            <textarea
              {...p}
              ref={noteRef}
              className="form-textarea"
              rows={3}
              maxLength={LIMITS.excuseNoteLength}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        <div className="ui-dialog-actions">
          <Button variant="secondary" onClick={close} disabled={save.pending}>
            Vazgeç
          </Button>
          <Button type="submit" loading={save.pending} loadingText="Kaydediliyor…">
            Kaydet
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// --- Son dersler ----------------------------------------------------------------------------

function RecentLectures() {
  const recent = useRecentLectures(10);
  const columns: Column<Lecture>[] = [
    { key: "date", header: "Tarih", cell: (l) => (l.startedAtMs ? dateTimeFormat.format(l.startedAtMs) : "—") },
    { key: "title", header: "Ders", rowHeader: true, cell: (l) => l.title },
    { key: "lecturer", header: "Eğitici", cell: (l) => l.lecturer },
    {
      key: "present",
      header: "Katılım",
      align: "end",
      cell: (l) => (
        <span className="mono-num">
          {l.presentCount} / {l.expectedCount || "—"}
        </span>
      ),
    },
    {
      key: "excused",
      header: "Mazeretli",
      align: "end",
      cell: (l) => <span className="mono-num">{l.excusedCount}</span>,
    },
    {
      key: "close",
      header: "Kapanış",
      cell: (l) => (l.closeReason === "expired" ? "Süre doldu" : "Eğitici kapattı"),
    },
  ];
  return (
    <Card title="Son dersler" description="Son 10 kapanan ders yoklaması.">
      <DataTable
        caption="Son kapanan ders yoklamaları"
        captionHidden
        columns={columns}
        rows={recent.data ?? []}
        rowKey={(l) => l.id}
        loading={recent.status === "loading"}
        error={recent.error}
        empty={<EmptyState title="Henüz kapanmış ders yok" />}
      />
    </Card>
  );
}
