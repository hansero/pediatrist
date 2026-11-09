"use client";

import { httpsCallable } from "firebase/functions";
import { initPediatristFirebase, isFirebaseConfigured } from "@/lib/firebase/client";
import type { GradedQuestionFeedback, QuizQuestionInput } from "@/lib/quiz-parser";

/**
 * Tüm yazma işlemleri Cloud Functions üzerinden yapılır (Firestore kuralları istemci yazımını kapatır).
 * Hata mesajları kullanıcıya gösterilmeden önce `toUserMessage` ile sadeleştirilir; teknik ayrıntı,
 * proje kimliği veya stack trace ekrana basılmaz.
 */
function callable<Req, Res>(name: string) {
  return async (data: Req): Promise<Res> => {
    const clients = initPediatristFirebase();
    if (!clients) throw new Error("Sunucu bağlantısı yapılandırılmamış.");
    const res = await httpsCallable<Req, Res>(clients.functions, name)(data);
    return res.data;
  };
}

/**
 * Kişisel telefon / cihaz bağlama için yerel tarayıcıda kriptografik sır üretir ve saklar.
 * Ham sır ekranda asla gösterilmez; sunucu tarafında SHA-256 özeti (`boundDeviceHash`) alınır.
 */
export function getOrCreateClientDeviceSecret(): string {
  if (typeof window === "undefined") return "server_render_device_placeholder";
  const storageKey = "pediatrist_device_secret_v1";
  let existing = window.localStorage.getItem(storageKey);
  if (!existing || existing.length < 16) {
    const bytes = new Uint8Array(24);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
      existing = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    } else {
      existing = `ped_dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
    window.localStorage.setItem(storageKey, existing);
  }
  return existing;
}

/**
 * Firebase yapılandırılmışsa ilgili Cloud Function'ı çağırır; çevrimdışı/lokal önizleme
 * ortamında ise hata fırlatmadan yerel geri dönüş (`fallbackFn`) değerini çalıştırır.
 */
export async function invokeWithFallback<Res, FallbackRes extends Res = Res>(
  thunk: () => Promise<Res>,
  fallbackFn: () => FallbackRes | Promise<FallbackRes>
): Promise<{ data: Res; syncedWithCloud: boolean }>;
export async function invokeWithFallback<Req, Res, FallbackRes extends Res = Res>(
  fn: (data: Req) => Promise<Res>,
  data: Req,
  fallbackFn: () => FallbackRes | Promise<FallbackRes>
): Promise<{ data: Res; syncedWithCloud: boolean }>;
export async function invokeWithFallback<Req = never, Res = unknown, FallbackRes extends Res = Res>(
  thunkOrFn: (() => Promise<Res>) | ((data: Req) => Promise<Res>),
  fallbackOrData: (() => FallbackRes | Promise<FallbackRes>) | Req,
  maybeFallback?: () => FallbackRes | Promise<FallbackRes>
): Promise<{ data: Res; syncedWithCloud: boolean }> {
  const isTwoArg = typeof maybeFallback === "undefined" && typeof fallbackOrData === "function";
  const fallbackFn = (isTwoArg ? fallbackOrData : maybeFallback) as () => FallbackRes | Promise<FallbackRes>;

  if (!isFirebaseConfigured()) {
    return { data: await fallbackFn(), syncedWithCloud: false };
  }
  try {
    const res = isTwoArg
      ? await (thunkOrFn as () => Promise<Res>)()
      : await (thunkOrFn as (d: Req) => Promise<Res>)(fallbackOrData as Req);
    return { data: res, syncedWithCloud: true };
  } catch {
    return { data: await fallbackFn(), syncedWithCloud: false };
  }
}

export function toUserMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e?.code?.startsWith("functions/") && e.code !== "functions/internal" && e.message) return e.message;
  return "İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin.";
}

// --- Modül 5: Üye, Rol (RBAC) ve Cihaz Bağı Yönetimi ---
export const updateMemberAccess = callable<
  {
    targetUid: string;
    role?: "admin" | "user";
    status?: "active" | "pending" | "suspended";
    residencyYear?: number;
    resetBoundDevice?: boolean;
    resetDeviceBinding?: boolean;
  },
  { ok?: boolean; success?: boolean; targetUid: string; role?: string; status?: string; residencyYear?: number }
>("updateMemberAccess");

// --- Modül 3: Ders Katılım ---
export const startLectureSession = callable<
  { title: string; lecturer: string; category: string; durationMinutes: number },
  {
    ok?: boolean;
    sessionId: string;
    status?: string;
    durationMinutes?: number;
    expiresAtMs?: number;
    endsAtMs?: number;
  }
>("startLectureSession");

export const endLectureSession = callable<
  { sessionId: string },
  { ok?: boolean; closed?: boolean; sessionId?: string; status?: string }
>("endLectureSession");

export const getProjectorCode = callable<
  { sessionId: string },
  { code: string; msUntilRotation?: number; secondsUntilRotation?: number; endsAtMs?: number }
>("getProjectorCode");

export const verifyRealTimeAttendance = callable<
  {
    sessionId: string;
    dynamicCode?: string;
    dynamicToken?: string;
    clientDeviceSecret?: string;
    deviceId?: string;
    webAuthnVerified: boolean;
  },
  {
    ok?: boolean;
    verified?: boolean;
    alreadyRecorded?: boolean;
    status?: string;
    verifiedAt?: string;
    fullName?: string;
    residencyYear?: number;
  }
>("verifyRealTimeAttendance");

export const markAttendanceExcused = callable<
  { sessionId: string; targetUid: string; excuseNote: string },
  { ok: boolean; sessionId?: string; targetUid?: string; status?: string }
>("markAttendanceExcused");

// --- Modül 4: Online Quiz ---
export const saveQuizDraft = callable<
  {
    quizId?: string;
    title: string;
    durationMinutes: number;
    closesAtMs?: number | null;
    sourceFileName?: string;
    questions: QuizQuestionInput[];
  },
  { ok?: boolean; quizId: string; questionCount: number; durationMinutes?: number; status?: string }
>("saveQuizDraft");

export const publishQuiz = callable<
  { quizId: string; durationMinutes?: number; closesAtMs?: number | null },
  { ok?: boolean; published?: boolean; quizId?: string; durationMinutes?: number; archivedPreviousCount?: number }
>("publishQuiz");

export const closeQuiz = callable<{ quizId: string }, { ok?: boolean; closed?: boolean }>("closeQuiz");

export const startQuizAttempt = callable<
  { quizId: string },
  {
    ok?: boolean;
    attemptId?: string;
    quizId?: string;
    durationMinutes?: number;
    expiresAtMs?: number;
    deadlineMs?: number;
    resumed?: boolean;
  }
>("startQuizAttempt");

export const submitQuizAttempt = callable<
  { attemptId?: string; quizId: string; responses: Record<string, string[]>; tabSwitchCount: number },
  {
    ok?: boolean;
    attemptId?: string;
    score: number;
    correctCount: number;
    totalQuestions: number;
    isExpired?: boolean;
    lateSubmission?: boolean;
    gradedReport: GradedQuestionFeedback[];
  }
>("submitQuizAttempt");
