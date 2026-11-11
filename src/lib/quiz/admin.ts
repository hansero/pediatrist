"use client";

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { DEFAULT_REVEAL_POLICY, QUESTION_TYPES, type QuestionType, type RevealPolicy } from "@shared/constants";
import { COLLECTIONS, type QuizStatus } from "@shared/types";
import { useFirestoreSnapshot, type LiveState } from "@/hooks/useFirestoreSnapshot";
import { AppError } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";

/**
 * Admin sınav stüdyosu verisi (F5.2). Bütün yazmalar callable'lardadır (`saveQuizDraft`, `publishQuiz`, …);
 * burada yalnızca kuralların admin'e açtığı okumalar var: `quizzes` (taslak dahil) ve `quiz_question_archive`.
 */

const ms = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === "function" ? (v as Timestamp).toMillis() : null;

export interface QuizSummary {
  id: string;
  title: string;
  status: QuizStatus;
  durationMinutes: number;
  closesAtMs: number | null;
  revealPolicy: RevealPolicy;
  questionCount: number;
  attemptCount: number;
  sourceFileName: string;
  createdAtMs: number | null;
  publishedAtMs: number | null;
  closedAtMs: number | null;
  revealAtMs: number | null;
  closeReason: "manual" | "replaced" | "expired" | null;
}

export function toQuizSummary(id: string, d: DocumentData): QuizSummary {
  const status: QuizStatus = d.status === "published" || d.status === "closed" ? d.status : "draft";
  return {
    id,
    title: String(d.title ?? ""),
    status,
    durationMinutes: Number(d.durationMinutes ?? 0),
    closesAtMs: ms(d.closesAt),
    revealPolicy: d.revealPolicy === "immediate" ? "immediate" : DEFAULT_REVEAL_POLICY,
    questionCount: Number(d.questionCount ?? 0),
    attemptCount: Number(d.attemptCount ?? 0),
    sourceFileName: String(d.sourceFileName ?? ""),
    createdAtMs: ms(d.createdAt),
    publishedAtMs: ms(d.publishedAt),
    closedAtMs: ms(d.closedAt),
    revealAtMs: ms(d.revealAt),
    closeReason:
      d.closeReason === "manual" || d.closeReason === "replaced" || d.closeReason === "expired" ? d.closeReason : null,
  };
}

export const QUIZ_STATUS_LABEL: Record<QuizStatus, string> = {
  draft: "Taslak",
  published: "Yayında",
  closed: "Kapalı",
};

export const REVEAL_POLICY_LABEL: Record<RevealPolicy, string> = {
  after_close: "Sınav kapanınca",
  immediate: "Teslimde hemen",
};

/** Admin: bütün sınavlar (yeniden eskiye, son 100), canlı. */
export function useQuizzes(count = 100): LiveState<QuizSummary[]> {
  return useFirestoreSnapshot<QuizSummary[]>(
    (onData, onError) => {
      const db = initPediatristFirebase()?.db;
      if (!db) return null;
      const q = query(collection(db, COLLECTIONS.quizzes), orderBy("createdAt", "desc"), limit(count));
      return onSnapshot(q, (snap) => onData(snap.docs.map((d) => toQuizSummary(d.id, d.data()))), onError);
    },
    [count]
  );
}

// --- Arşiv --------------------------------------------------------------------------------------

/** Arşivlenmiş soru: 9 alanın tamamı (admin'e açık) + kaynak sınav. */
export interface ArchivedQuestion {
  id: string;
  sourceQuizId: string;
  sourceQuizTitle: string;
  archivedAtMs: number | null;
  orderIndex: number;
  caseContent: string;
  imageUrl: string;
  questionText: string;
  questionType: QuestionType;
  maxLength: number;
  optionsArray: string[];
  correctAnswers: string[];
  feedbackText: string;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function toArchivedQuestion(id: string, d: DocumentData): ArchivedQuestion {
  return {
    id,
    sourceQuizId: String(d.sourceQuizId ?? ""),
    sourceQuizTitle: String(d.sourceQuizTitle ?? ""),
    archivedAtMs: ms(d.archivedAt),
    orderIndex: Number(d.orderIndex ?? 0),
    caseContent: String(d.caseContent ?? ""),
    imageUrl: String(d.imageUrl ?? ""),
    questionText: String(d.questionText ?? ""),
    questionType: QUESTION_TYPES.includes(d.questionType) ? d.questionType : "Single Choice",
    maxLength: Number(d.maxLength ?? 0),
    optionsArray: strings(d.optionsArray),
    correctAnswers: strings(d.correctAnswers),
    feedbackText: String(d.feedbackText ?? ""),
  };
}

export const ARCHIVE_PAGE_SIZE = 50;

export interface ArchivePage {
  items: ArchivedQuestion[];
  /** Sonraki sayfa için imleç; son sayfadaysa `null`. */
  cursor: QueryDocumentSnapshot | null;
}

/** Arşiv: yeniden eskiye, sayfalı (tek alanlı indeks). */
export async function fetchArchivePage(after: QueryDocumentSnapshot | null = null): Promise<ArchivePage> {
  const db = initPediatristFirebase()?.db;
  if (!db) throw new AppError("not-configured", "Sunucu bağlantısı yapılandırılmamış.");
  const base = collection(db, COLLECTIONS.quizQuestionArchive);
  const snap = await getDocs(
    after
      ? query(base, orderBy("archivedAt", "desc"), startAfter(after), limit(ARCHIVE_PAGE_SIZE))
      : query(base, orderBy("archivedAt", "desc"), limit(ARCHIVE_PAGE_SIZE))
  );
  return {
    items: snap.docs.map((d) => toArchivedQuestion(d.id, d.data())),
    cursor: snap.size === ARCHIVE_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
  };
}
