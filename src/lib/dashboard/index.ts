"use client";

import {
  collection,
  count,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  query,
  sum,
  Timestamp,
  where,
} from "firebase/firestore";
import { materialAudienceOf, matchesAudience } from "@shared/materials";
import { COLLECTIONS, type AttendanceStatus } from "@shared/types";
import { notConfiguredError } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { isLectureOpen, type Lecture } from "@/lib/attendance/live";
import type { MaterialView } from "@/lib/materials/admin";
import type { QuizSummary } from "@/lib/quiz/admin";
import { resumableAttempt, type MyAttempt } from "@/lib/quiz/doctor";

/**
 * Durum odaklı ana sayfa (F7.3). Ana kart TEK bir birincil eylem gösterir; göstergeler sunucuda sayılır
 * (`getCountFromServer` / `getAggregateFromServer`). Sabit veya tahmini sayı yoktur: veri yoksa "—" ve açıklama.
 */

function db() {
  const firestore = initPediatristFirebase()?.db;
  if (!firestore) throw notConfiguredError();
  return firestore;
}

// --- Sonraki adım (saf, birim testli) ----------------------------------------------------------------

export type DoctorStep =
  | { kind: "lecture"; lecture: Lecture }
  | { kind: "quiz-resume"; attempt: MyAttempt }
  | { kind: "quiz-start"; quiz: QuizSummary }
  | { kind: "material"; material: MaterialView; remaining: number }
  | { kind: "none" };

/**
 * Hekimin sıradaki işi, öncelik sırasıyla: açık derse katılmadıysa yoklama (en kısa süreli fırsat) → süresi
 * işleyen sınav girişimi → yayındaki, henüz girmediği sınav → tamamlamadığı zorunlu materyal (en eskisi).
 */
export function doctorNextStep(input: {
  lecture: Lecture | null;
  myRecordStatus: AttendanceStatus | null;
  quiz: QuizSummary | null;
  attempts: readonly MyAttempt[];
  pendingMaterials: readonly MaterialView[];
  nowMs: number;
}): DoctorStep {
  const { lecture, myRecordStatus, quiz, attempts, pendingMaterials, nowMs } = input;
  if (isLectureOpen(lecture, nowMs) && myRecordStatus === null) return { kind: "lecture", lecture };
  const resume = resumableAttempt(attempts, nowMs, quiz?.id ?? null);
  if (resume) return { kind: "quiz-resume", attempt: resume };
  if (
    quiz &&
    quiz.status === "published" &&
    (quiz.closesAtMs === null || quiz.closesAtMs > nowMs) &&
    !attempts.some((a) => a.quizId === quiz.id)
  ) {
    return { kind: "quiz-start", quiz };
  }
  if (pendingMaterials.length) {
    const oldest = [...pendingMaterials].sort(
      (a, b) => (a.publishedAtMs ?? a.createdAtMs ?? 0) - (b.publishedAtMs ?? b.createdAtMs ?? 0)
    )[0];
    return { kind: "material", material: oldest, remaining: pendingMaterials.length };
  }
  return { kind: "none" };
}

export type AdminStep =
  | { kind: "lecture"; lecture: Lecture }
  | { kind: "pending-members"; count: number }
  | { kind: "quiz"; quiz: QuizSummary }
  | { kind: "none" };

/** Eğitim sorumlusunun sıradaki işi: süren ders → onay bekleyen başvurular → yayındaki sınavın takibi. */
export function adminNextStep(input: {
  lecture: Lecture | null;
  pendingMembers: number | null;
  quiz: QuizSummary | null;
  nowMs: number;
}): AdminStep {
  if (isLectureOpen(input.lecture, input.nowMs)) return { kind: "lecture", lecture: input.lecture };
  if (input.pendingMembers) return { kind: "pending-members", count: input.pendingMembers };
  if (input.quiz && input.quiz.status === "published") return { kind: "quiz", quiz: input.quiz };
  return { kind: "none" };
}

/**
 * Hekime yönelik zorunlu materyaller: asistan → kendi kıdemi; Uzm. Dr. → "Uzman" hedefli olanlar (D26);
 * hiçbir hedef kitlede olmayan (Doç./Prof.) → bütün zorunlu materyaller.
 */
export function mandatoryFor(
  materials: readonly MaterialView[],
  member: { title: string; residencyYear: number | null }
): MaterialView[] {
  const audience = materialAudienceOf(member);
  return materials.filter(
    (m) => m.status === "published" && m.isMandatory && (audience === null || matchesAudience(m, audience))
  );
}

/** Katılım oranı (D22): katıldı / (katıldı + katılmadı); mazeretliler paydaya girmez. */
export const attendanceRate = (present: number, absent: number): number | null =>
  present + absent > 0 ? present / (present + absent) : null;

// --- Sunucu sayımları ------------------------------------------------------------------------------

/** Hekim: kendi zorunlu materyallerinden tamamladıkları (her biri için kendi `progress/{uid}` dokümanı). */
export async function fetchCompletedMaterialIds(uid: string, materialIds: readonly string[]): Promise<Set<string>> {
  const firestore = db();
  const snaps = await Promise.all(
    materialIds.map((id) => getDoc(doc(firestore, COLLECTIONS.materials, id, COLLECTIONS.materialProgress, uid)))
  );
  return new Set(snaps.filter((s) => s.exists() && s.data()?.completed === true).map((s) => s.ref.parent.parent!.id));
}

export interface AttendanceCounts {
  present: number;
  absent: number;
  excused: number;
  rate: number | null;
}

/** Hekim: bütün dersler boyunca kendi katılımı (kurallar yalnızca `uid == me` sorgusunu açar). */
export async function fetchMyAttendanceCounts(uid: string): Promise<AttendanceCounts> {
  const logs = collection(db(), COLLECTIONS.attendanceLogs);
  const countOf = async (status: AttendanceStatus) =>
    (await getCountFromServer(query(logs, where("uid", "==", uid), where("status", "==", status)))).data().count;
  const [present, absent, excused] = await Promise.all([countOf("present"), countOf("absent"), countOf("excused")]);
  return { present, absent, excused, rate: attendanceRate(present, absent) };
}

/** Admin: onay bekleyen başvuru sayısı. */
export async function fetchPendingMemberCount(): Promise<number> {
  const snap = await getCountFromServer(query(collection(db(), COLLECTIONS.users), where("status", "==", "pending")));
  return snap.data().count;
}

export const ATTENDANCE_KPI_DAYS = 30;

export interface LectureWindowStats {
  lectures: number;
  present: number;
  absent: number;
  rate: number | null;
}

/** Admin: son 30 günde kapanmış derslerin katılımı (ders sayaçlarının toplamı; indeks `status + startedAt`). */
export async function fetchRecentAttendanceStats(nowMs: number): Promise<LectureWindowStats> {
  const fromMs = nowMs - ATTENDANCE_KPI_DAYS * 86_400_000;
  const snap = await getAggregateFromServer(
    query(
      collection(db(), COLLECTIONS.attendanceSessions),
      where("status", "==", "closed"),
      where("startedAt", ">=", Timestamp.fromMillis(fromMs))
    ),
    { lectures: count(), present: sum("presentCount"), absent: sum("absentCount") }
  );
  const { lectures, present, absent } = snap.data();
  return { lectures, present: present ?? 0, absent: absent ?? 0, rate: attendanceRate(present ?? 0, absent ?? 0) };
}

export interface QuizParticipation {
  submitted: number;
  inProgress: number;
  activeDoctors: number;
}

/** Admin: yayındaki sınavda teslim eden / süren girişim / etkin hekim sayısı. */
export async function fetchQuizParticipation(quizId: string): Promise<QuizParticipation> {
  const firestore = db();
  const attempts = collection(firestore, COLLECTIONS.quizAttempts);
  const countOf = async (status: "submitted" | "in_progress") =>
    (await getCountFromServer(query(attempts, where("quizId", "==", quizId), where("status", "==", status)))).data()
      .count;
  const [submitted, inProgress, doctors] = await Promise.all([
    countOf("submitted"),
    countOf("in_progress"),
    getCountFromServer(
      query(collection(firestore, COLLECTIONS.users), where("status", "==", "active"), where("role", "==", "user"))
    ),
  ]);
  return { submitted, inProgress, activeDoctors: doctors.data().count };
}
