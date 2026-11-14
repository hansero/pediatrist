"use client";

import { collection, limit, onSnapshot, query, where, type DocumentData, type Timestamp } from "firebase/firestore";
import { QUIZ_SUBMIT_GRACE_MS } from "@shared/constants";
import { COLLECTIONS } from "@shared/types";
import { useCapped, useFirestoreSnapshot, type CappedState, type LiveState } from "@/hooks/useFirestoreSnapshot";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { toQuizSummary, type QuizSummary } from "./admin";

/**
 * Hekim sınav verisi (F5.3). Kurallar: hekim yalnızca yayındaki/kapanmış sınavın başlık dokümanını ve kendi
 * girişimlerini okur (liste sorgusu `uid == me` içermek zorunda). Sorular yalnızca `startQuizAttempt` ile gelir.
 */

const ms = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === "function" ? (v as Timestamp).toMillis() : null;

/** Yayındaki sınav (en fazla bir tane; sunucu yeni yayında öncekini kapatır). */
export function usePublishedQuiz(): LiveState<QuizSummary | null> {
  return useFirestoreSnapshot<QuizSummary | null>((onData, onError) => {
    const db = initPediatristFirebase()?.db;
    if (!db) return null;
    const q = query(collection(db, COLLECTIONS.quizzes), where("status", "==", "published"), limit(1));
    return onSnapshot(
      q,
      (snap) => onData(snap.empty ? null : toQuizSummary(snap.docs[0].id, snap.docs[0].data())),
      onError
    );
  }, []);
}

export interface MyAttempt {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  status: "in_progress" | "submitted";
  deadlineMs: number | null;
  submittedAtMs: number | null;
  score: number | null;
  correctCount: number | null;
  totalQuestions: number | null;
  lateSubmission: boolean;
  autoSubmitted: boolean;
}

export function toMyAttempt(id: string, d: DocumentData): MyAttempt {
  return {
    attemptId: id,
    quizId: String(d.quizId ?? ""),
    quizTitle: String(d.quizTitle ?? ""),
    status: d.status === "submitted" ? "submitted" : "in_progress",
    deadlineMs: ms(d.deadline),
    submittedAtMs: ms(d.submittedAt),
    score: typeof d.score === "number" ? d.score : null,
    correctCount: typeof d.correctCount === "number" ? d.correctCount : null,
    totalQuestions: typeof d.totalQuestions === "number" ? d.totalQuestions : null,
    lateSubmission: d.lateSubmission === true,
    autoSubmitted: d.autoSubmitted === true,
  };
}

/**
 * Hekimin bütün girişimleri (canlı). Doküman tek tek okunmaz: kural `uid == me` içeren sorguyu açar.
 * Devam eden girişim yayındaki sınava ait olmayabilir (sınav erken kapandıysa süresi sürer, F5.1).
 */
export function useMyAttempts(uid: string, count = 200): CappedState<MyAttempt> {
  const state = useFirestoreSnapshot<MyAttempt[]>(
    (onData, onError) => {
      const db = initPediatristFirebase()?.db;
      if (!db) return null;
      const q = query(collection(db, COLLECTIONS.quizAttempts), where("uid", "==", uid), limit(count + 1));
      return onSnapshot(
        q,
        (snap) =>
          onData(
            snap.docs
              .map((d) => toMyAttempt(d.id, d.data()))
              .sort((a, b) => (b.submittedAtMs ?? Infinity) - (a.submittedAtMs ?? Infinity))
          ),
        onError
      );
    },
    [uid, count]
  );
  return useCapped(state, count);
}

/**
 * Süresi (+ teslim toleransı) dolmamış, teslim edilmemiş girişim: sınava dönülebilir. Birden fazla olabilir
 * (hekim A'dayken admin B'yi zorla yayınladı ve hekim B'ye de girdi): yayındaki sınavınki önceliklidir.
 */
export function resumableAttempt(
  attempts: readonly MyAttempt[],
  nowMs = Date.now(),
  preferQuizId: string | null = null
): MyAttempt | null {
  const open = attempts.filter(
    (a) => a.status === "in_progress" && a.deadlineMs !== null && a.deadlineMs + QUIZ_SUBMIT_GRACE_MS > nowMs
  );
  return open.find((a) => a.quizId === preferQuizId) ?? open[0] ?? null;
}

/** Soru yanıtlandı mı (seçenek seçildi / boş olmayan metin)? */
export function isAnswered(response: readonly string[] | undefined): boolean {
  return Boolean(response && response.some((r) => r.trim().length > 0));
}
