import { HttpsError } from "firebase-functions/v2/https";
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentSnapshot,
  type Firestore,
  type WriteBatch,
} from "firebase-admin/firestore";
import { auditIn } from "./auditLogger";
import { defineCallable } from "./callable";
import { QUIZ_SUBMIT_GRACE_MS } from "./shared/constants";
import { normalizeClinicalAnswer as norm } from "./shared/quizQuestion";
import { COLLECTIONS, type GradedItem, type QuizAnswerKeyDoc, type QuizQuestionPublicDoc } from "./shared/types";

/**
 * MODÜL 4 — ONLINE QUIZ (Sunucu Tarafı)
 *
 * Yaşam döngüsü:  draft ──publishQuiz──▶ published ──closeQuiz / yeni yayın──▶ closed
 *
 *  - Admin CSV'yi tarayıcıda ayrıştırır ve önizler, ardından `saveQuizDraft` ile taslak oluşturur.
 *    Sunucu 9 alanı, istemci önizlemesiyle AYNI şemayla yeniden doğrular (shared/quizQuestion.ts).
 *  - `publishQuiz`: varsa yayındaki sınav kapatılır ve soruları 9 alanıyla arşive taşınır.
 *  - Hekim `startQuizAttempt` ile sınava girer → sunucu başlangıç zamanını ve bitiş sınırını kaydeder.
 *  - `submitQuizAttempt`: süre sınırı (+30 sn tolerans) sunucuda denetlenir, puanlama sunucuda yapılır.
 *  - 8. (Doğru Seçenek) ve 9. (Feedback_Text) alanlar `quiz_answer_keys` içinde, istemciye kapalıdır.
 *
 * F5.1'de: soruların attempt ile teslimi, `revealPolicy`, taslak yanıt kaydı, transaction'lı teslim.
 */

const quizzes = () => getFirestore().collection(COLLECTIONS.quizzes);
const answerKeyItems = (quizId: string) =>
  getFirestore().collection(COLLECTIONS.quizAnswerKeys).doc(quizId).collection(COLLECTIONS.quizAnswerKeyItems);

/** Kapanış zamanı verilmişse gelecekte olmalı (şemalar saf olduğu için burada denetlenir). */
function closesAtFrom(closesAtMs: number | null | undefined): Timestamp | null | undefined {
  if (closesAtMs === undefined) return undefined;
  if (closesAtMs === null) return null;
  if (closesAtMs <= Date.now()) {
    throw new HttpsError("invalid-argument", "Kapanış zamanı gelecekte bir an olmalıdır.");
  }
  return Timestamp.fromMillis(closesAtMs);
}

/** Admin: CSV'den önizlenen soruları taslak sınav olarak kaydeder (henüz hekimlere görünmez). */
export const saveQuizDraft = defineCallable("saveQuizDraft", "admin", async (data, actor) => {
  const db = getFirestore();
  const quizRef = quizzes().doc();
  const batch = db.batch();
  batch.set(quizRef, {
    title: data.title,
    status: "draft",
    durationMinutes: data.durationMinutes,
    closesAt: closesAtFrom(data.closesAtMs) ?? null,
    questionCount: data.questions.length,
    sourceFileName: data.sourceFileName,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    attemptCount: 0,
  });
  data.questions.forEach((q, idx) => {
    const qId = `q_${String(idx + 1).padStart(3, "0")}`;
    const publicPart: QuizQuestionPublicDoc = {
      orderIndex: idx + 1,
      caseContent: q.caseContent,
      imageUrl: q.imageUrl,
      questionText: q.questionText,
      questionType: q.questionType,
      maxLength: q.maxLength,
      optionsRaw: q.optionsRaw,
      optionsArray: q.optionsArray,
    };
    const privatePart: QuizAnswerKeyDoc = { correctAnswers: q.correctAnswers, feedbackText: q.feedbackText };
    batch.set(quizRef.collection(COLLECTIONS.quizQuestionsPublic).doc(qId), publicPart);
    batch.set(answerKeyItems(quizRef.id).doc(qId), privatePart);
  });
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "QUIZ_DRAFT_CREATED_FROM_CSV",
    resourceType: "quizzes",
    resourceId: quizRef.id,
    metadata: { questionCount: data.questions.length, sourceFileName: data.sourceFileName },
  });
  await batch.commit();

  return { quizId: quizRef.id, questionCount: data.questions.length };
});

/** Bir sınavı kapatır ve 9 alanlı sorularını kayıp önleyici arşive taşır (batch'e ekler). */
async function closeAndArchive(db: Firestore, batch: WriteBatch, quizDoc: DocumentSnapshot, actorUid: string) {
  const [pubSnap, keySnap] = await Promise.all([
    quizDoc.ref.collection(COLLECTIONS.quizQuestionsPublic).get(),
    answerKeyItems(quizDoc.id).get(),
  ]);
  const keys = new Map(keySnap.docs.map((d) => [d.id, d.data() as QuizAnswerKeyDoc]));
  pubSnap.docs.forEach((qDoc) => {
    const priv = keys.get(qDoc.id) ?? { correctAnswers: [], feedbackText: "" };
    batch.set(db.collection(COLLECTIONS.quizQuestionArchive).doc(), {
      sourceQuizId: quizDoc.id,
      sourceQuizTitle: quizDoc.data()?.title ?? "",
      archivedAt: FieldValue.serverTimestamp(),
      archivedBy: actorUid,
      ...qDoc.data(),
      correctAnswers: priv.correctAnswers,
      feedbackText: priv.feedbackText,
    });
  });
  batch.update(quizDoc.ref, { status: "closed", closedAt: FieldValue.serverTimestamp() });
}

/** Admin: taslağı yayına alır. Süreyi son kez burada belirleyebilir. */
export const publishQuiz = defineCallable("publishQuiz", "admin", async (data, actor) => {
  const db = getFirestore();
  const quizRef = quizzes().doc(data.quizId);
  const quizSnap = await quizRef.get();
  if (!quizSnap.exists || quizSnap.data()?.status !== "draft") {
    throw new HttpsError("failed-precondition", "Yalnızca taslak durumundaki sınavlar yayına alınabilir.");
  }
  const durationMinutes = data.durationMinutes ?? Number(quizSnap.data()?.durationMinutes);
  const closesAt = closesAtFrom(data.closesAtMs);

  const batch = db.batch();
  const currentlyPublished = await quizzes().where("status", "==", "published").get();
  for (const doc of currentlyPublished.docs) {
    await closeAndArchive(db, batch, doc, actor.uid);
  }
  batch.update(quizRef, {
    status: "published",
    durationMinutes,
    closesAt: closesAt === undefined ? (quizSnap.data()?.closesAt ?? null) : closesAt,
    publishedAt: FieldValue.serverTimestamp(),
    publishedBy: actor.uid,
  });
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "QUIZ_PUBLISHED",
    resourceType: "quizzes",
    resourceId: data.quizId,
    metadata: { durationMinutes, closedAndArchived: currentlyPublished.size },
  });
  await batch.commit();

  return { published: true as const, archivedPreviousCount: currentlyPublished.size };
});

/** Admin: yayındaki sınavı kapatır ve arşivler. */
export const closeQuiz = defineCallable("closeQuiz", "admin", async (data, actor) => {
  const db = getFirestore();
  const quizSnap = await quizzes().doc(data.quizId).get();
  if (!quizSnap.exists || quizSnap.data()?.status !== "published") {
    throw new HttpsError("failed-precondition", "Yalnızca yayındaki sınav kapatılabilir.");
  }
  const batch = db.batch();
  await closeAndArchive(db, batch, quizSnap, actor.uid);
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "QUIZ_CLOSED_AND_ARCHIVED",
    resourceType: "quizzes",
    resourceId: data.quizId,
  });
  await batch.commit();
  return { closed: true as const };
});

/** Hekim: yayındaki sınava girer. Her hekim her sınava bir kez girebilir; yarıda kalan giriş devam ettirilir. */
export const startQuizAttempt = defineCallable("startQuizAttempt", "member", async (data, actor) => {
  const db = getFirestore();
  const quizSnap = await quizzes().doc(data.quizId).get();
  const quiz = quizSnap.data();
  if (!quiz || quiz.status !== "published") {
    throw new HttpsError("failed-precondition", "Bu sınav şu anda aktif değil.");
  }

  const nowMs = Date.now();
  const closesAtMs = quiz.closesAt ? (quiz.closesAt as Timestamp).toMillis() : null;
  if (closesAtMs && closesAtMs <= nowMs) throw new HttpsError("failed-precondition", "Sınavın kapanış zamanı geçti.");

  const attemptRef = db.collection(COLLECTIONS.quizAttempts).doc(`${data.quizId}_${actor.uid}`);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(attemptRef);
    if (existing.exists) {
      const attempt = existing.data()!;
      if (attempt.status === "submitted") throw new HttpsError("already-exists", "Bu sınavı zaten tamamladınız.");
      return { deadlineMs: (attempt.deadline as Timestamp).toMillis(), resumed: true };
    }
    let deadlineMs = nowMs + Number(quiz.durationMinutes) * 60_000;
    if (closesAtMs) deadlineMs = Math.min(deadlineMs, closesAtMs);

    const { profile } = actor;
    tx.set(attemptRef, {
      quizId: data.quizId,
      quizTitle: quiz.title,
      uid: actor.uid,
      doctorName: `${profile.title ?? ""} ${profile.fullName ?? ""}`.trim() || actor.email,
      residencyYear: profile.residencyYear ?? 1,
      status: "in_progress",
      startedAt: Timestamp.fromMillis(nowMs),
      deadline: Timestamp.fromMillis(deadlineMs),
      durationMinutes: quiz.durationMinutes,
    });
    tx.update(quizSnap.ref, { attemptCount: FieldValue.increment(1) });
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "QUIZ_ATTEMPT_STARTED",
      resourceType: "quizzes",
      resourceId: data.quizId,
    });
    return { deadlineMs, resumed: false };
  });
});

/** Hekim: yanıtları gönderir; puanlama ve Feedback_Text karnesi sunucuda üretilir. */
export const submitQuizAttempt = defineCallable("submitQuizAttempt", "member", async (data, actor) => {
  const db = getFirestore();
  const attemptRef = db.collection(COLLECTIONS.quizAttempts).doc(`${data.quizId}_${actor.uid}`);
  const attempt = (await attemptRef.get()).data();
  if (!attempt || attempt.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Aktif bir sınav girişiniz bulunmuyor.");
  }

  const nowMs = Date.now();
  const deadlineMs = (attempt.deadline as Timestamp).toMillis();
  const lateSubmission = nowMs > deadlineMs + QUIZ_SUBMIT_GRACE_MS;

  const [pubSnap, keySnap] = await Promise.all([
    quizzes().doc(data.quizId).collection(COLLECTIONS.quizQuestionsPublic).orderBy("orderIndex").get(),
    answerKeyItems(data.quizId).get(),
  ]);
  const keys = new Map(keySnap.docs.map((d) => [d.id, d.data() as QuizAnswerKeyDoc]));

  let correctCount = 0;
  const gradedReport: GradedItem[] = pubSnap.docs.map((qDoc) => {
    const q = qDoc.data() as QuizQuestionPublicDoc;
    const key = keys.get(qDoc.id) ?? { correctAnswers: [], feedbackText: "" };
    // Süre aşımında yanıtlar değerlendirmeye alınmaz (0 puan) ama karne yine gösterilir.
    const userRes = lateSubmission ? [] : (data.responses[qDoc.id] ?? []).map((r) => r.slice(0, q.maxLength || 500));

    let isCorrect = false;
    if (q.questionType === "Text Input") {
      const typed = norm(userRes[0] ?? "");
      isCorrect = typed.length > 0 && key.correctAnswers.some((a) => norm(a) === typed);
    } else {
      const u = userRes.map(norm).sort();
      const c = key.correctAnswers.map(norm).sort();
      isCorrect = u.length === c.length && u.every((v, i) => v === c[i]);
    }
    if (isCorrect) correctCount++;

    return {
      questionId: qDoc.id,
      orderIndex: q.orderIndex,
      caseContent: q.caseContent,
      imageUrl: q.imageUrl ?? "",
      questionText: q.questionText,
      questionType: q.questionType,
      isCorrect,
      userResponse: userRes,
      correctAnswers: key.correctAnswers,
      feedbackText: key.feedbackText,
    };
  });

  const totalQuestions = pubSnap.size || 1;
  const score = Math.round((correctCount / totalQuestions) * 100);
  const startedMs = (attempt.startedAt as Timestamp).toMillis();

  const batch = db.batch();
  batch.update(attemptRef, {
    status: "submitted",
    submittedAt: Timestamp.fromMillis(nowMs),
    durationSeconds: Math.round((Math.min(nowMs, deadlineMs) - startedMs) / 1000),
    lateSubmission,
    score,
    correctCount,
    totalQuestions,
    gradedReport,
    tabSwitchCount: data.tabSwitchCount,
  });
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "QUIZ_ATTEMPT_SUBMITTED",
    resourceType: "quizzes",
    resourceId: data.quizId,
    severity: lateSubmission || data.tabSwitchCount > 0 ? "WARN" : "INFO",
    metadata: { score, lateSubmission, tabSwitchCount: data.tabSwitchCount },
  });
  await batch.commit();

  return { score, correctCount, totalQuestions, gradedReport, lateSubmission };
});
