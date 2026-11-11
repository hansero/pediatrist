"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query, Timestamp, where } from "firebase/firestore";
import { ATTENDANCE_WARN_RATE } from "@shared/constants";
import { COLLECTIONS, type AttendanceStatus } from "@shared/types";
import { toUserMessage, notConfiguredError } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";
import type { CsvCell } from "@/lib/csv";
import { slugify } from "@/lib/slug";
import {
  summarizeHistory,
  toLecture,
  toLogItem,
  type AttendanceRecordView,
  type HistorySummary,
  type Lecture,
  type LiveState,
  type LogItem,
  type MemberSummary,
} from "./live";

/**
 * Yoklama raporları (F4.5): ders raporu ve hekim karnesi. Kaynak yalnızca sunucunun yazdığı veridir:
 * kapanmış dersler (`attendance_sessions`), ders kayıtları (`records`) ve düz log (`attendance_logs`).
 * D22 sayesinde kapanmış her derste beklenen her hekimin kaydı vardır (katıldı / mazeretli / katılmadı),
 * bu yüzden oranlar kayıtlardan eksiksiz hesaplanır. Oran tanımı her yerde aynıdır: katıldı / (katıldı +
 * katılmadı); mazeretliler paydaya girmez (`summarizeHistory`).
 */

export const REPORT_DEFAULT_DAYS = 90;
/** Bir raporda okunacak en fazla ders / log. Aşılırsa rapor bunu açıkça söyler (tarih aralığı daraltılır). */
export const REPORT_LECTURE_LIMIT = 200;
export const REPORT_LOG_LIMIT = 5000;

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Katıldı",
  excused: "Mazeretli",
  absent: "Katılmadı",
};

export const residencyLabel = (year: number | null) => (year ? `${year}. yıl` : "Uzman");

export const isBelowThreshold = (rate: number | null, threshold = ATTENDANCE_WARN_RATE) =>
  rate !== null && rate < threshold;

/** Oranı tam sayı yüzdeye çevirir (CSV ve ekran); ders yoksa `null`. */
export const ratePercent = (rate: number | null) => (rate === null ? null : Math.round(rate * 100));

// --- Tarih aralığı ----------------------------------------------------------------------------

/** `<input type="date">` değerleri (yerel saat, YYYY-AA-GG). */
export interface ReportRange {
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function defaultReportRange(now = new Date()): ReportRange {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - REPORT_DEFAULT_DAYS);
  return { from: toDateInput(from), to: toDateInput(now) };
}

function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

export type RangeBounds = { ok: true; fromMs: number; toMs: number } | { ok: false; error: string };

/** Başlangıç gününün başından bitiş gününün sonuna (ikisi de dahil, yerel saat). */
export function rangeBounds(range: ReportRange): RangeBounds {
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);
  if (!from || !to) return { ok: false, error: "Geçerli bir başlangıç ve bitiş tarihi girin." };
  if (from > to) return { ok: false, error: "Başlangıç tarihi bitiş tarihinden sonra olamaz." };
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).getTime() - 1;
  return { ok: true, fromMs: from.getTime(), toMs: end };
}

// --- Okuma ----------------------------------------------------------------------------------

export interface Fetched<T> {
  items: T[];
  /** Sınıra ulaşıldı: daha eski kayıtlar rapora girmedi. */
  truncated: boolean;
}

function db() {
  const firestore = initPediatristFirebase()?.db;
  if (!firestore) throw notConfiguredError();
  return firestore;
}

/** Aralıkta başlamış, kapanmış dersler (yeniden eskiye). İndeks: `status` + `startedAt desc`. */
export async function fetchClosedLectures(bounds: { fromMs: number; toMs: number }): Promise<Fetched<Lecture>> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.attendanceSessions),
      where("status", "==", "closed"),
      where("startedAt", ">=", Timestamp.fromMillis(bounds.fromMs)),
      where("startedAt", "<=", Timestamp.fromMillis(bounds.toMs)),
      orderBy("startedAt", "desc"),
      limit(REPORT_LECTURE_LIMIT + 1)
    )
  );
  const items = snap.docs.slice(0, REPORT_LECTURE_LIMIT).map((d) => toLecture(d.id, d.data()));
  return { items, truncated: snap.size > REPORT_LECTURE_LIMIT };
}

/** Aralıkta başlamış derslerin bütün katılım logları (admin okur; tek alanlı indeks). */
export async function fetchLogs(bounds: { fromMs: number; toMs: number }): Promise<Fetched<LogItem>> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.attendanceLogs),
      where("sessionStartedAt", ">=", Timestamp.fromMillis(bounds.fromMs)),
      where("sessionStartedAt", "<=", Timestamp.fromMillis(bounds.toMs)),
      orderBy("sessionStartedAt", "desc"),
      limit(REPORT_LOG_LIMIT + 1)
    )
  );
  const items = snap.docs.slice(0, REPORT_LOG_LIMIT).map((d) => toLogItem(d.data()));
  return { items, truncated: snap.size > REPORT_LOG_LIMIT };
}

/**
 * Tek seferlik okuma kancası (raporlar canlı dinlenmez; "Yenile" ile yeniden okunur). Eski isteğin geç gelen
 * sonucu yeni isteğin üzerine yazılmaz.
 */
export function useReportQuery<T>(
  load: (() => Promise<T>) | null,
  deps: unknown[]
): LiveState<T> & { reload: () => void } {
  const [state, setState] = useState<LiveState<T>>({ status: "loading", data: null, error: "" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    setState({ status: "loading", data: null, error: "" });
    load().then(
      (data) => !cancelled && setState({ status: "ready", data, error: "" }),
      (err: unknown) => !cancelled && setState({ status: "error", data: null, error: toUserMessage(err) })
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}

// --- Ders raporu ------------------------------------------------------------------------------

export interface LectureReportRow {
  uid: string;
  name: string;
  residencyYear: number | null;
  status: AttendanceStatus;
  verifiedAtMs: number | null;
  excuseNote?: string;
  /** Ders başında beklenen listede miydi (sonradan üye olup katılan `false`)? */
  expected: boolean;
}

export interface LectureReport {
  rows: LectureReportRow[];
  summary: HistorySummary & { expected: number };
}

export function buildLectureReport(
  lecture: Pick<Lecture, "expectedAttendees" | "expectedCount">,
  records: AttendanceRecordView[]
): LectureReport {
  const rows = records
    .map((r) => ({
      uid: r.uid,
      name: `${r.title} ${r.fullName}`.trim(),
      residencyYear: r.residencyYear,
      status: r.status,
      verifiedAtMs: r.verifiedAtMs,
      excuseNote: r.excuseNote,
      expected: lecture.expectedAttendees.includes(r.uid),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  return { rows, summary: { ...summarizeHistory(records), expected: lecture.expectedCount } };
}

// --- Hekim karnesi --------------------------------------------------------------------------

export interface DoctorReportRow extends HistorySummary {
  uid: string;
  name: string;
  residencyYear: number | null;
  /** Şu an etkin hekim mi (askıya alınmış / ayrılmış üyenin geçmişi de raporda kalır). */
  active: boolean;
  belowThreshold: boolean;
  /** Bu hekimin aralıktaki dersleri (yeniden eskiye). */
  items: LogItem[];
}

/**
 * Logları hekim başına toplar. Etkin ama aralıkta hiç beklenmemiş hekim de satır olarak görünür (oran yok).
 * `excludeSessionIds`: henüz kapanmamış (canlı) ders; katılmadı kayıtları kapanışta yazıldığından orana katılmaz.
 * Sıra: eşik altındakiler önce (en düşük oran başta), sonra ada göre.
 */
export function buildDoctorReport(
  logs: LogItem[],
  doctors: MemberSummary[],
  {
    excludeSessionIds = [],
    threshold = ATTENDANCE_WARN_RATE,
  }: { excludeSessionIds?: string[]; threshold?: number } = {}
): DoctorReportRow[] {
  const excluded = new Set(excludeSessionIds);
  const byUid = new Map<string, LogItem[]>();
  for (const log of logs) {
    if (excluded.has(log.sessionId)) continue;
    byUid.set(log.uid, [...(byUid.get(log.uid) ?? []), log]);
  }
  const doctorByUid = new Map(doctors.map((d) => [d.uid, d]));
  const uids = new Set([...doctors.map((d) => d.uid), ...byUid.keys()]);

  const rows = [...uids].map((uid): DoctorReportRow => {
    const items = (byUid.get(uid) ?? []).sort((a, b) => (b.startedAtMs ?? 0) - (a.startedAtMs ?? 0));
    const doctor = doctorByUid.get(uid);
    const summary = summarizeHistory(items);
    return {
      uid,
      name: doctor
        ? `${doctor.title} ${doctor.fullName}`.trim()
        : `${items[0]?.memberTitle ?? ""} ${items[0]?.fullName ?? ""}`.trim() || "Bilinmeyen üye",
      residencyYear: doctor ? doctor.residencyYear : (items[0]?.residencyYear ?? null),
      active: Boolean(doctor),
      ...summary,
      belowThreshold: isBelowThreshold(summary.rate, threshold),
      items,
    };
  });

  return rows.sort((a, b) => {
    if (a.belowThreshold !== b.belowThreshold) return a.belowThreshold ? -1 : 1;
    if (a.belowThreshold && a.rate !== b.rate) return (a.rate ?? 0) - (b.rate ?? 0);
    return a.name.localeCompare(b.name, "tr");
  });
}

// --- CSV --------------------------------------------------------------------------------------

export interface CsvExport {
  fileName: string;
  headers: string[];
  rows: CsvCell[][];
}

/** CSV'de tarih/saat: yerel saatle `YYYY-AA-GG SS:DD` (Excel sıralayabilir). */
export function csvDateTime(msValue: number | null): string {
  if (!msValue) return "";
  const d = new Date(msValue);
  return `${toDateInput(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export { slugify } from "@/lib/slug";

export function lectureReportCsv(lecture: Lecture, report: LectureReport): CsvExport {
  return {
    fileName: `yoklama-${toDateInput(new Date(lecture.startedAtMs))}-${slugify(lecture.title)}.csv`,
    headers: [
      "Ders",
      "Tarih",
      "Eğitici",
      "Kategori",
      "Hekim",
      "Kıdem",
      "Durum",
      "Katılım saati",
      "Mazeret notu",
      "Beklenen listede",
    ],
    rows: report.rows.map((r) => [
      lecture.title,
      csvDateTime(lecture.startedAtMs),
      lecture.lecturer,
      lecture.category,
      r.name,
      residencyLabel(r.residencyYear),
      STATUS_LABEL[r.status],
      r.status === "present" ? csvDateTime(r.verifiedAtMs) : "",
      r.excuseNote ?? "",
      r.expected ? "Evet" : "Hayır",
    ]),
  };
}

export function doctorReportCsv(rows: DoctorReportRow[], range: ReportRange): CsvExport {
  return {
    fileName: `hekim-karnesi-${range.from}_${range.to}.csv`,
    headers: [
      "Hekim",
      "Kıdem",
      "Üyelik",
      "Katıldı",
      "Mazeretli",
      "Katılmadı",
      "Katılım oranı (%)",
      `Eşik altında (%${ratePercent(ATTENDANCE_WARN_RATE)})`,
    ],
    rows: rows.map((r) => [
      r.name,
      residencyLabel(r.residencyYear),
      r.active ? "Etkin" : "Etkin değil",
      r.present,
      r.excused,
      r.absent,
      ratePercent(r.rate),
      r.belowThreshold ? "Evet" : "Hayır",
    ]),
  };
}

export function doctorDetailCsv(row: DoctorReportRow, range: ReportRange): CsvExport {
  return {
    fileName: `hekim-karnesi-${slugify(row.name)}-${range.from}_${range.to}.csv`,
    headers: ["Hekim", "Tarih", "Ders", "Eğitici", "Kategori", "Durum", "Katılım saati", "Mazeret notu"],
    rows: row.items.map((i) => [
      row.name,
      csvDateTime(i.startedAtMs),
      i.title,
      i.lecturer,
      i.category,
      STATUS_LABEL[i.status],
      i.status === "present" ? csvDateTime(i.verifiedAtMs) : "",
      i.excuseNote ?? "",
    ]),
  };
}
