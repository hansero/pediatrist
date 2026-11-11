"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { COLLECTIONS } from "@shared/types";
import type { CsvCell } from "@/lib/csv";
import { AppError } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { slugify } from "@/lib/slug";

/**
 * Sınav analitiği (F5.4). Kaynak yalnızca sunucunun yazdığı girişimlerdir (`quiz_attempts`); girişimlerde
 * doğru cevap yoktur, yalnızca puan ve soru başına doğru/yanlış (F5.1). Gruplama hekim KİMLİĞİNE (uid) göre
 * yapılır: aynı adlı iki hekim karışmaz, adı değişen hekim bölünmez (AUDIT kullanılabilirlik).
 */

const ms = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === "function" ? (v as Timestamp).toMillis() : null;

export interface AttemptRow {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  uid: string;
  doctorName: string;
  residencyYear: number | null;
  score: number;
  correctCount: number;
  totalQuestions: number;
  submittedAtMs: number;
  durationSeconds: number | null;
  lateSubmission: boolean;
  autoSubmitted: boolean;
  tabSwitchCount: number;
  results: { questionId: string; orderIndex: number; isCorrect: boolean }[];
}

/** Teslim edilmiş girişim → satır; teslim edilmemişse `null`. */
export function toAttemptRow(id: string, d: DocumentData): AttemptRow | null {
  const submittedAtMs = ms(d.submittedAt);
  if (d.status !== "submitted" || submittedAtMs === null) return null;
  return {
    attemptId: id,
    quizId: String(d.quizId ?? ""),
    quizTitle: String(d.quizTitle ?? ""),
    uid: String(d.uid ?? ""),
    doctorName: String(d.doctorName ?? ""),
    residencyYear: typeof d.residencyYear === "number" ? d.residencyYear : null,
    score: Number(d.score ?? 0),
    correctCount: Number(d.correctCount ?? 0),
    totalQuestions: Number(d.totalQuestions ?? 0),
    submittedAtMs,
    durationSeconds: typeof d.durationSeconds === "number" ? d.durationSeconds : null,
    lateSubmission: d.lateSubmission === true,
    autoSubmitted: d.autoSubmitted === true,
    tabSwitchCount: Number(d.tabSwitchCount ?? 0),
    results: Array.isArray(d.results)
      ? d.results.map((r: DocumentData) => ({
          questionId: String(r.questionId ?? ""),
          orderIndex: Number(r.orderIndex ?? 0),
          isCorrect: r.isCorrect === true,
        }))
      : [],
  };
}

// --- Okuma ---------------------------------------------------------------------------------------

export const ATTEMPT_QUERY_LIMIT = 500;

export interface FetchedAttempts {
  rows: AttemptRow[];
  truncated: boolean;
}

function db() {
  const firestore = initPediatristFirebase()?.db;
  if (!firestore) throw new AppError("not-configured", "Sunucu bağlantısı yapılandırılmamış.");
  return firestore;
}

/**
 * Bir sınavın teslim edilmiş girişimleri (yeniden eskiye; `quizId + submittedAt desc` indeksi).
 * `orderBy(submittedAt)` teslim edilmemiş (alanı olmayan) girişimleri zaten dışarıda bırakır.
 */
export async function fetchQuizAttempts(quizId: string): Promise<FetchedAttempts> {
  const snap = await getDocs(
    query(
      collection(db(), COLLECTIONS.quizAttempts),
      where("quizId", "==", quizId),
      orderBy("submittedAt", "desc"),
      limit(ATTEMPT_QUERY_LIMIT + 1)
    )
  );
  const rows = snap.docs.slice(0, ATTEMPT_QUERY_LIMIT).flatMap((d) => toAttemptRow(d.id, d.data()) ?? []);
  return { rows, truncated: snap.size > ATTEMPT_QUERY_LIMIT };
}

/** Bütün sınavlardaki son teslimler (hekim gelişimi için; tek alanlı indeks). */
export async function fetchRecentAttempts(): Promise<FetchedAttempts> {
  const snap = await getDocs(
    query(collection(db(), COLLECTIONS.quizAttempts), orderBy("submittedAt", "desc"), limit(ATTEMPT_QUERY_LIMIT + 1))
  );
  const rows = snap.docs.slice(0, ATTEMPT_QUERY_LIMIT).flatMap((d) => toAttemptRow(d.id, d.data()) ?? []);
  return { rows, truncated: snap.size > ATTEMPT_QUERY_LIMIT };
}

// --- Hesaplar ------------------------------------------------------------------------------------

export interface ScoreSummary {
  count: number;
  /** Tam sayıya yuvarlanmış ortalama; girişim yoksa `null`. */
  average: number | null;
  median: number | null;
  best: number | null;
  /** En yeni teslimin puanı. */
  latest: number | null;
}

export function summarizeScores(rows: readonly Pick<AttemptRow, "score" | "submittedAtMs">[]): ScoreSummary {
  if (rows.length === 0) return { count: 0, average: null, median: null, best: null, latest: null };
  const scores = rows.map((r) => r.score).sort((a, b) => a - b);
  const mid = Math.floor(scores.length / 2);
  const median = scores.length % 2 ? scores[mid] : Math.round((scores[mid - 1] + scores[mid]) / 2);
  const latest = [...rows].sort((a, b) => b.submittedAtMs - a.submittedAtMs)[0].score;
  return {
    count: rows.length,
    average: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    median,
    best: scores[scores.length - 1],
    latest,
  };
}

export interface QuestionStat {
  questionId: string;
  orderIndex: number;
  correct: number;
  answered: number;
  /** 0–1 */
  rate: number;
}

/** Soru bazında doğru oranı (soru sırasıyla). En zor sorular sınavın zayıf konusunu gösterir. */
export function questionStats(rows: readonly Pick<AttemptRow, "results">[]): QuestionStat[] {
  const byId = new Map<string, QuestionStat>();
  for (const row of rows) {
    for (const r of row.results) {
      const s = byId.get(r.questionId) ?? {
        questionId: r.questionId,
        orderIndex: r.orderIndex,
        correct: 0,
        answered: 0,
        rate: 0,
      };
      s.answered += 1;
      if (r.isCorrect) s.correct += 1;
      byId.set(r.questionId, s);
    }
  }
  return [...byId.values()]
    .map((s) => ({ ...s, rate: s.answered ? s.correct / s.answered : 0 }))
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export type SubmissionKind = "all" | "normal" | "late" | "auto";

export const submissionKind = (
  r: Pick<AttemptRow, "lateSubmission" | "autoSubmitted">
): Exclude<SubmissionKind, "all"> => (r.autoSubmitted ? "auto" : r.lateSubmission ? "late" : "normal");

export const SUBMISSION_LABEL: Record<Exclude<SubmissionKind, "all">, string> = {
  normal: "Zamanında",
  late: "Geç",
  auto: "Otomatik",
};

export function filterAttempts<T extends Pick<AttemptRow, "residencyYear" | "lateSubmission" | "autoSubmitted">>(
  rows: readonly T[],
  { year, kind }: { year: number | "all" | "specialist"; kind: SubmissionKind }
): T[] {
  return rows.filter(
    (r) =>
      (year === "all" || (year === "specialist" ? r.residencyYear === null : r.residencyYear === year)) &&
      (kind === "all" || submissionKind(r) === kind)
  );
}

export interface DoctorProgressRow extends ScoreSummary {
  uid: string;
  /** En yeni girişimdeki ad (ad değişse de kayıt aynı hekimde kalır). */
  name: string;
  residencyYear: number | null;
  attempts: AttemptRow[];
}

/** Hekim KİMLİĞİNE göre gruplama; en düşük ortalama önce (desteğe ihtiyacı olan hekim üstte), sonra ada göre. */
export function groupByDoctor(rows: readonly AttemptRow[]): DoctorProgressRow[] {
  const byUid = new Map<string, AttemptRow[]>();
  for (const r of rows) byUid.set(r.uid, [...(byUid.get(r.uid) ?? []), r]);
  return [...byUid.entries()]
    .map(([uid, list]) => {
      const attempts = [...list].sort((a, b) => b.submittedAtMs - a.submittedAtMs);
      return {
        uid,
        name: attempts[0].doctorName,
        residencyYear: attempts[0].residencyYear,
        attempts,
        ...summarizeScores(attempts),
      };
    })
    .sort((a, b) => (a.average ?? 0) - (b.average ?? 0) || a.name.localeCompare(b.name, "tr"));
}

// --- CSV -----------------------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");
const csvDateTime = (v: number) => {
  const d = new Date(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function attemptsCsv(quizTitle: string, rows: readonly AttemptRow[]) {
  return {
    fileName: `sinav-sonuclari-${slugify(quizTitle)}.csv`,
    headers: [
      "Sınav",
      "Hekim",
      "Kıdem",
      "Puan",
      "Doğru",
      "Soru",
      "Teslim",
      "Teslim türü",
      "Süre (dk)",
      "Sekme değişimi",
    ],
    rows: rows.map((r): CsvCell[] => [
      r.quizTitle,
      r.doctorName,
      r.residencyYear ? `${r.residencyYear}. yıl` : "Uzman",
      r.score,
      r.correctCount,
      r.totalQuestions,
      csvDateTime(r.submittedAtMs),
      SUBMISSION_LABEL[submissionKind(r)],
      r.durationSeconds === null ? "" : Math.round(r.durationSeconds / 60),
      r.tabSwitchCount,
    ]),
  };
}
