import { HttpsError } from "firebase-functions/v2/https";
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction,
  type WriteBatch,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { auditIn } from "./auditLogger";
import { defineCallable } from "./callable";
import type { MemberContext } from "./guards";
import { buildReport, gradeAttempt, type GradableQuestion } from "./quizGrading";
import { DEFAULT_REVEAL_POLICY, QUIZ_SUBMIT_GRACE_MS, type RevealPolicy } from "./shared/constants";
import type { NormalizedQuizQuestion } from "./shared/quizQuestion";
import {
  COLLECTIONS,
  type QuizAnswerKeyDoc,
  type QuizAttemptDoc,
  type QuizAttemptDraftDoc,
  type QuizDoc,
  type QuizQuestionPublicDoc,
} from "./shared/types";

/**
 * MODÜL 4 — ONLINE SINAV (sunucu, F5.1)
 *
 * Yaşam döngüsü:  draft ──publishQuiz──▶ published ──closeQuiz / yeni yayın / kapanış zamanı──▶ closed
 *
 *  - Taslak: `saveQuizDraft` / `updateQuizDraft` / `deleteQuizDraft`. Sorular admin önizlemesiyle AYNI şemayla
 *    doğrulanır (shared/quizQuestion.ts); görsellerin Storage'da var olduğu denetlenir.
 *  - Yayın: yayındaki sınav kapatılır ve 9 alanıyla arşivlenir. O sınavda devam eden girişim varsa admin onayı
 *    (`force`) istenir; devam edenler süreleri dolana kadar teslim edebilir (sorular girişimden gelir).
 *  - Hekim soruları YALNIZCA `startQuizAttempt` yanıtıyla alır (kurallar `questions_public`'i kapatır, AUDIT C7).
 *    Devam ederken aynı sorular ve süre içinde kaydedilmiş yanıtlar (`saveAttemptDraft`) döner.
 *  - Teslim transaction'dır (`in_progress` ön koşulu): çift teslim olmaz. Puanlama sunucuda; girişime yalnızca
 *    puan ve soru başına doğru/yanlış + yanıt yazılır, doğru cevap ve feedback YAZILMAZ.
 *  - Süre + 30 sn tolerans aşılırsa süre içinde kaydedilmiş yanıtlar puanlanır; teslim edilmeyen girişimi
 *    zamanlayıcı aynı şekilde teslim eder (`finalizeExpiredAttempts`).
 *  - Karne (D7): `immediate` → teslimde tam karne; `after_close` → sınav kapanıp `revealAt` geçince
 *    (`getAttemptReport`). `revealAt`, kapanışta devam eden girişimlerin en geç bitişidir: cevap sızmaz.
 */

const db = () => getFirestore();
const quizzes = () => db().collection(COLLECTIONS.quizzes);
const attempts = () => db().collection(COLLECTIONS.quizAttempts);
const attemptDrafts = () => db().collection(COLLECTIONS.quizAttemptDrafts);
const publicQuestions = (quizId: string) => quizzes().doc(quizId).collection(COLLECTIONS.quizQuestionsPublic);
const answerKeyItems = (quizId: string) =>
  db().collection(COLLECTIONS.quizAnswerKeys).doc(quizId).collection(COLLECTIONS.quizAnswerKeyItems);

export const attemptIdOf = (quizId: string, uid: string) => `${quizId}_${uid}`;

/**
 * Sınav saatinin tek kaynağı. Testler süre/kapanış senaryolarında yalnızca bunu ileri alır; `Date.now`'u
 * genel olarak taklit etmek Firestore SDK'sının kendi zamanlayıcılarını bozuyor.
 */
export const quizClock = { now: (): number => Date.now() };
const questionIdOf = (index: number) => `q_${String(index + 1).padStart(3, "0")}`;
const SYSTEM = { actorUid: "system", actorEmail: "system" } as const;

type Quiz = QuizDoc<Timestamp>;
type Attempt = QuizAttemptDoc<Timestamp>;

const policyOf = (quiz: Partial<Quiz> | undefined): RevealPolicy =>
  quiz?.revealPolicy === "immediate" ? "immediate" : DEFAULT_REVEAL_POLICY;
const msOf = (t: unknown): number | null =>
  t && typeof (t as Timestamp).toMillis === "function" ? (t as Timestamp).toMillis() : null;

// --- Yardımcılar -------------------------------------------------------------------------------

/** Kapanış zamanı verilmişse gelecekte olmalı (şemalar saf olduğu için burada denetlenir). */
function futureClosesAt(closesAtMs: number | null | undefined): Timestamp | null | undefined {
  if (closesAtMs === undefined) return undefined;
  if (closesAtMs === null) return null;
  if (closesAtMs <= quizClock.now())
    throw new HttpsError("invalid-argument", "Kapanış zamanı gelecekte bir an olmalıdır.");
  return Timestamp.fromMillis(closesAtMs);
}

/** Sorulardaki `quiz_media/...` görsellerinin Storage'da var olduğunu denetler (CSV satır numarasıyla). */
async function assertMediaExists(questions: readonly NormalizedQuizQuestion[]) {
  const bucket = getStorage().bucket();
  const checks = questions.map((q, index) => ({ path: q.imageUrl, row: index + 2 })).filter((c) => c.path);
  const missing: string[] = [];
  const cache = new Map<string, Promise<boolean>>();
  for (const c of checks) {
    if (!cache.has(c.path))
      cache.set(
        c.path,
        bucket
          .file(c.path)
          .exists()
          .then(([e]) => e)
      );
  }
  for (const c of checks) {
    if (!(await cache.get(c.path))) missing.push(`Satır ${c.row}: soru görseli bulunamadı (${c.path}).`);
  }
  if (missing.length) {
    const extra = missing.length > 3 ? ` (+${missing.length - 3} hata daha)` : "";
    throw new HttpsError(
      "invalid-argument",
      `${missing.slice(0, 3).join(" ")}${extra} Görseli önce yükleyin veya yolu düzeltin.`
    );
  }
}

/** Soru setini yazar: q_001.. kimlikleri üzerine yazılır, eski setin fazlası silinir (açık + kapalı alanlar). */
function writeQuestions(
  target: WriteBatch | Transaction,
  quizRef: DocumentReference,
  questions: readonly NormalizedQuizQuestion[],
  previousCount = 0
) {
  // WriteBatch ve Transaction'ın set/delete imzaları uyumludur (bkz. auditIn).
  const writer = target as WriteBatch;
  questions.forEach((q, idx) => {
    const qId = questionIdOf(idx);
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
    writer.set(quizRef.collection(COLLECTIONS.quizQuestionsPublic).doc(qId), publicPart);
    writer.set(answerKeyItems(quizRef.id).doc(qId), privatePart);
  });
  for (let idx = questions.length; idx < previousCount; idx++) {
    writer.delete(quizRef.collection(COLLECTIONS.quizQuestionsPublic).doc(questionIdOf(idx)));
    writer.delete(answerKeyItems(quizRef.id).doc(questionIdOf(idx)));
  }
}

/** Sınavın soruları ve cevap anahtarı (sıralı). Yayından sonra değişmez; transaction dışında okunabilir. */
export async function loadQuestions(quizId: string): Promise<GradableQuestion[]> {
  const [pubSnap, keySnap] = await Promise.all([
    publicQuestions(quizId).orderBy("orderIndex").get(),
    answerKeyItems(quizId).get(),
  ]);
  const keys = new Map(keySnap.docs.map((d) => [d.id, d.data() as QuizAnswerKeyDoc]));
  return pubSnap.docs.map((d) => ({
    id: d.id,
    data: d.data() as QuizQuestionPublicDoc,
    key: keys.get(d.id) ?? { correctAnswers: [], feedbackText: "" },
  }));
}

/** Karne şu an açık mı (D7)? Admin her zaman görür. */
function isRevealed(quiz: Partial<Quiz> | undefined, nowMs: number): boolean {
  if (policyOf(quiz) === "immediate") return true;
  if (quiz?.status !== "closed") return false;
  const revealAtMs = msOf(quiz.revealAt) ?? msOf(quiz.closedAt) ?? 0;
  return nowMs >= revealAtMs;
}

function revealAtMsFor(quiz: Partial<Quiz> | undefined): number | null {
  if (policyOf(quiz) === "immediate") return null;
  return quiz?.status === "closed" ? (msOf(quiz.revealAt) ?? msOf(quiz.closedAt)) : null;
}

// --- Kapanış (arşiv + revealAt) ------------------------------------------------------------------

interface ClosePlan {
  inProgressCount: number;
  revealAtMs: number;
  apply: (tx: Transaction) => void;
}

/**
 * Bir sınavın kapanışını hazırlar: önce bütün OKUMALAR (sorular, anahtar, devam eden girişimler), sonra
 * `apply` ile YAZMALAR (transaction kuralı). 9 alanlı sorular kayıp önleyici arşive kopyalanır.
 */
async function prepareClose(
  tx: Transaction,
  quizSnap: DocumentSnapshot,
  closedBy: string,
  reason: NonNullable<Quiz["closeReason"]>,
  nowMs: number
): Promise<ClosePlan> {
  const quizId = quizSnap.id;
  const [pubSnap, keySnap, inProgress] = await Promise.all([
    tx.get(publicQuestions(quizId)),
    tx.get(answerKeyItems(quizId)),
    tx.get(attempts().where("quizId", "==", quizId).where("status", "==", "in_progress")),
  ]);
  const latestDeadline = Math.max(0, ...inProgress.docs.map((d) => msOf(d.data().deadline) ?? 0));
  const revealAtMs = Math.max(nowMs, latestDeadline ? latestDeadline + QUIZ_SUBMIT_GRACE_MS : 0);
  const keys = new Map(keySnap.docs.map((d) => [d.id, d.data() as QuizAnswerKeyDoc]));
  const title = String(quizSnap.data()?.title ?? "");

  return {
    inProgressCount: inProgress.size,
    revealAtMs,
    apply(writer) {
      pubSnap.docs.forEach((qDoc) => {
        const key = keys.get(qDoc.id) ?? { correctAnswers: [], feedbackText: "" };
        writer.set(db().collection(COLLECTIONS.quizQuestionArchive).doc(), {
          sourceQuizId: quizId,
          sourceQuizTitle: title,
          archivedAt: FieldValue.serverTimestamp(),
          archivedBy: closedBy,
          ...qDoc.data(),
          correctAnswers: key.correctAnswers,
          feedbackText: key.feedbackText,
        });
      });
      writer.update(quizSnap.ref, {
        status: "closed",
        closedAt: Timestamp.fromMillis(nowMs),
        closedBy,
        closeReason: reason,
        revealAt: Timestamp.fromMillis(revealAtMs),
      });
    },
  };
}

// --- Taslak --------------------------------------------------------------------------------------

/** Admin: CSV'den önizlenen soruları taslak sınav olarak kaydeder (henüz hekimlere görünmez). */
export const saveQuizDraft = defineCallable("saveQuizDraft", "admin", async (data, actor) => {
  await assertMediaExists(data.questions);
  const quizRef = quizzes().doc();
  const batch = db().batch();
  batch.set(quizRef, {
    title: data.title,
    status: "draft",
    durationMinutes: data.durationMinutes,
    closesAt: futureClosesAt(data.closesAtMs) ?? null,
    revealPolicy: data.revealPolicy,
    questionCount: data.questions.length,
    sourceFileName: data.sourceFileName,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    attemptCount: 0,
  });
  writeQuestions(batch, quizRef, data.questions);
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

async function draftOrThrow(tx: Transaction, quizId: string) {
  const snap = await tx.get(quizzes().doc(quizId));
  if (!snap.exists) throw new HttpsError("not-found", "Sınav bulunamadı.");
  if (snap.data()?.status !== "draft") {
    throw new HttpsError("failed-precondition", "Yalnızca taslak durumundaki sınav değiştirilebilir veya silinebilir.");
  }
  return snap;
}

/** Admin: taslağı günceller. `questions` verilirse soru seti tamamen değişir. */
export const updateQuizDraft = defineCallable("updateQuizDraft", "admin", async (data, actor) => {
  if (data.questions) await assertMediaExists(data.questions);
  const closesAt = futureClosesAt(data.closesAtMs);
  return db().runTransaction(async (tx) => {
    const snap = await draftOrThrow(tx, data.quizId);
    const previousCount = Number(snap.data()?.questionCount ?? 0);
    const questionCount = data.questions?.length ?? previousCount;
    tx.update(snap.ref, {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
      ...(closesAt !== undefined ? { closesAt } : {}),
      ...(data.revealPolicy !== undefined ? { revealPolicy: data.revealPolicy } : {}),
      ...(data.sourceFileName !== undefined ? { sourceFileName: data.sourceFileName } : {}),
      questionCount,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (data.questions) writeQuestions(tx, snap.ref, data.questions, previousCount);
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "QUIZ_DRAFT_UPDATED",
      resourceType: "quizzes",
      resourceId: data.quizId,
      metadata: { questionCount, questionsReplaced: Boolean(data.questions) },
    });
    return { quizId: data.quizId, questionCount };
  });
});

/** Admin: taslağı (soruları ve cevap anahtarıyla) siler. Yayınlanmış/kapanmış sınav silinmez (kayıt bütünlüğü). */
export const deleteQuizDraft = defineCallable("deleteQuizDraft", "admin", async (data, actor) => {
  await db().runTransaction(async (tx) => {
    const snap = await draftOrThrow(tx, data.quizId);
    const [pub, keys] = await Promise.all([tx.get(publicQuestions(data.quizId)), tx.get(answerKeyItems(data.quizId))]);
    pub.docs.forEach((d) => tx.delete(d.ref));
    keys.docs.forEach((d) => tx.delete(d.ref));
    tx.delete(db().collection(COLLECTIONS.quizAnswerKeys).doc(data.quizId));
    tx.delete(snap.ref);
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "QUIZ_DRAFT_DELETED",
      resourceType: "quizzes",
      resourceId: data.quizId,
      metadata: { title: String(snap.data()?.title ?? "") },
    });
  });
  return { deleted: true as const };
});

// --- Yayın / kapanış ------------------------------------------------------------------------------

/** Admin: taslağı yayına alır; yayındaki sınavı kapatıp arşivler (devam eden girişim varsa önce onay ister). */
export const publishQuiz = defineCallable("publishQuiz", "admin", async (data, actor) => {
  const closesAtOverride = futureClosesAt(data.closesAtMs);
  return db().runTransaction(async (tx) => {
    const nowMs = quizClock.now();
    const quizSnap = await tx.get(quizzes().doc(data.quizId));
    if (!quizSnap.exists || quizSnap.data()?.status !== "draft") {
      throw new HttpsError("failed-precondition", "Yalnızca taslak durumundaki sınavlar yayına alınabilir.");
    }
    const quiz = quizSnap.data() as Quiz;
    const durationMinutes = data.durationMinutes ?? Number(quiz.durationMinutes);
    const closesAt = closesAtOverride === undefined ? (quiz.closesAt ?? null) : closesAtOverride;
    if (closesAt && closesAt.toMillis() <= nowMs) {
      throw new HttpsError("invalid-argument", "Taslağın kapanış zamanı geçmiş; yayınlarken yeni bir zaman seçin.");
    }

    const current = await tx.get(quizzes().where("status", "==", "published"));
    const plans: ClosePlan[] = [];
    for (const doc of current.docs) plans.push(await prepareClose(tx, doc, actor.uid, "replaced", nowMs));
    const inProgressCount = plans.reduce((n, p) => n + p.inProgressCount, 0);
    if (inProgressCount > 0 && !data.force) {
      return {
        published: false as const,
        inProgressCount,
        currentQuizTitle: current.docs.map((d) => String(d.data().title ?? "")).join(", "),
      };
    }

    plans.forEach((p) => p.apply(tx));
    const revealPolicy = data.revealPolicy ?? policyOf(quiz);
    tx.update(quizSnap.ref, {
      status: "published",
      durationMinutes,
      closesAt,
      revealPolicy,
      publishedAt: Timestamp.fromMillis(nowMs),
      publishedBy: actor.uid,
    });
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "QUIZ_PUBLISHED",
      resourceType: "quizzes",
      resourceId: data.quizId,
      metadata: {
        durationMinutes,
        revealPolicy,
        closedAndArchived: current.size,
        ...(inProgressCount ? { forcedWithInProgress: inProgressCount } : {}),
      },
    });
    return { published: true as const, archivedPreviousCount: current.size };
  });
});

/** Admin: yayındaki sınavı kapatır ve arşivler. Devam edenler süreleri dolana kadar teslim edebilir. */
export const closeQuiz = defineCallable("closeQuiz", "admin", async (data, actor) => {
  return db().runTransaction(async (tx) => {
    const nowMs = quizClock.now();
    const quizSnap = await tx.get(quizzes().doc(data.quizId));
    if (!quizSnap.exists || quizSnap.data()?.status !== "published") {
      throw new HttpsError("failed-precondition", "Yalnızca yayındaki sınav kapatılabilir.");
    }
    const plan = await prepareClose(tx, quizSnap, actor.uid, "manual", nowMs);
    plan.apply(tx);
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "QUIZ_CLOSED_AND_ARCHIVED",
      resourceType: "quizzes",
      resourceId: data.quizId,
      metadata: { inProgressCount: plan.inProgressCount },
    });
    return { closed: true as const, inProgressCount: plan.inProgressCount, revealAtMs: plan.revealAtMs };
  });
});

/** Zamanlayıcı: kapanış zamanı geçen yayındaki sınavları kapatır. Kapananların kimliklerini döner. */
export async function closeExpiredQuizzes(nowMs = quizClock.now()): Promise<string[]> {
  const due = await quizzes()
    .where("status", "==", "published")
    .where("closesAt", "<=", Timestamp.fromMillis(nowMs))
    .get();
  const closed: string[] = [];
  for (const doc of due.docs) {
    const done = await db().runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      const closesAtMs = msOf(snap.data()?.closesAt);
      if (snap.data()?.status !== "published" || closesAtMs === null || closesAtMs > nowMs) return false;
      const plan = await prepareClose(tx, snap, "system", "expired", nowMs);
      plan.apply(tx);
      auditIn(tx, {
        ...SYSTEM,
        action: "QUIZ_CLOSED_AT_DEADLINE",
        resourceType: "quizzes",
        resourceId: doc.id,
        metadata: { inProgressCount: plan.inProgressCount },
      });
      return true;
    });
    if (done) closed.push(doc.id);
  }
  return closed;
}

// --- Girişim ---------------------------------------------------------------------------------------

function attemptQuestions(questions: readonly GradableQuestion[]) {
  return questions.map((q) => ({
    questionId: q.id,
    orderIndex: q.data.orderIndex,
    caseContent: q.data.caseContent,
    imagePath: q.data.imageUrl ?? "",
    questionText: q.data.questionText,
    questionType: q.data.questionType,
    maxLength: q.data.maxLength,
    options: q.data.optionsArray ?? [],
  }));
}

async function savedResponsesOf(attemptId: string): Promise<Record<string, string[]>> {
  const draft = (await attemptDrafts().doc(attemptId).get()).data() as QuizAttemptDraftDoc<Timestamp> | undefined;
  return draft?.responses ?? {};
}

/**
 * Hekim: sınava girer veya yarıda kalan girişimine döner. Sorular (1–7. alanlar) ve kaydedilmiş yanıtlar bu
 * yanıtla gelir. Kapatılmış sınavda süresi devam eden girişim de sürdürülebilir.
 */
export const startQuizAttempt = defineCallable("startQuizAttempt", "member", async (data, actor) => {
  const attemptId = attemptIdOf(data.quizId, actor.uid);
  const attemptRef = attempts().doc(attemptId);

  const outcome = await db().runTransaction(async (tx) => {
    const nowMs = quizClock.now();
    const [existing, quizSnap] = await Promise.all([tx.get(attemptRef), tx.get(quizzes().doc(data.quizId))]);
    const quiz = quizSnap.data() as Quiz | undefined;
    if (existing.exists) {
      const attempt = existing.data() as Attempt;
      if (attempt.status === "submitted") throw new HttpsError("already-exists", "Bu sınavı zaten tamamladınız.");
      return {
        resumed: true,
        deadlineMs: attempt.deadline.toMillis(),
        title: attempt.quizTitle,
        policy: attempt.revealPolicy ?? policyOf(quiz),
      };
    }
    if (!quiz || quiz.status !== "published")
      throw new HttpsError("failed-precondition", "Bu sınav şu anda aktif değil.");
    const closesAtMs = msOf(quiz.closesAt);
    if (closesAtMs !== null && closesAtMs <= nowMs) {
      throw new HttpsError("failed-precondition", "Sınavın kapanış zamanı geçti.");
    }
    let deadlineMs = nowMs + Number(quiz.durationMinutes) * 60_000;
    if (closesAtMs !== null) deadlineMs = Math.min(deadlineMs, closesAtMs);
    const policy = policyOf(quiz);

    const { profile } = actor;
    tx.set(attemptRef, {
      quizId: data.quizId,
      quizTitle: quiz.title,
      uid: actor.uid,
      doctorName: `${profile.title ?? ""} ${profile.fullName ?? ""}`.trim() || actor.email,
      residencyYear: profile.residencyYear ?? null,
      status: "in_progress",
      revealPolicy: policy,
      questionCount: Number(quiz.questionCount ?? 0),
      startedAt: Timestamp.fromMillis(nowMs),
      deadline: Timestamp.fromMillis(deadlineMs),
      durationMinutes: quiz.durationMinutes,
    } satisfies Attempt);
    tx.update(quizSnap.ref, { attemptCount: FieldValue.increment(1) });
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "QUIZ_ATTEMPT_STARTED",
      resourceType: "quizzes",
      resourceId: data.quizId,
    });
    return { resumed: false, deadlineMs, title: quiz.title, policy };
  });

  const [questions, savedResponses] = await Promise.all([
    loadQuestions(data.quizId),
    outcome.resumed ? savedResponsesOf(attemptId) : Promise.resolve({}),
  ]);
  return {
    attemptId,
    quizTitle: outcome.title,
    deadlineMs: outcome.deadlineMs,
    serverNowMs: quizClock.now(),
    resumed: outcome.resumed,
    revealPolicy: outcome.policy,
    questions: attemptQuestions(questions),
    savedResponses,
  };
});

/** Hekim: yanıtları ara kaydeder (istemci debounce'lu çağırır). Süre + tolerans geçtiyse reddedilir. */
export const saveAttemptDraft = defineCallable("saveAttemptDraft", "member", async (data, actor) => {
  const attemptId = attemptIdOf(data.quizId, actor.uid);
  return db().runTransaction(async (tx) => {
    const nowMs = quizClock.now();
    const attempt = (await tx.get(attempts().doc(attemptId))).data() as Attempt | undefined;
    if (!attempt || attempt.status !== "in_progress") {
      throw new HttpsError("failed-precondition", "Aktif bir sınav girişiniz bulunmuyor.");
    }
    if (nowMs > attempt.deadline.toMillis() + QUIZ_SUBMIT_GRACE_MS) {
      throw new HttpsError("deadline-exceeded", "Sınav süresi doldu; yanıtlar artık kaydedilemez.");
    }
    tx.set(attemptDrafts().doc(attemptId), {
      uid: actor.uid,
      quizId: data.quizId,
      responses: data.responses,
      updatedAt: Timestamp.fromMillis(nowMs),
    } satisfies QuizAttemptDraftDoc<Timestamp>);
    return { savedAtMs: nowMs };
  });
});

interface FinalizeInput {
  attemptRef: DocumentReference;
  questions: readonly GradableQuestion[];
  /** Hekimin teslim ettiği yanıtlar; yoksa (zamanlayıcı) kaydedilmiş yanıtlar kullanılır. */
  submitted: Record<string, string[]> | null;
  tabSwitchCount?: number;
  actor: { uid: string; email: string } | null;
}

/**
 * Girişimi transaction içinde teslim eder (`in_progress` ön koşulu → çift teslim yok). Süre + tolerans
 * geçtiyse ya da zamanlayıcı teslim ediyorsa süre içinde kaydedilmiş yanıtlar puanlanır.
 */
async function finalizeAttempt({ attemptRef, questions, submitted, tabSwitchCount = 0, actor }: FinalizeInput) {
  return db().runTransaction(async (tx) => {
    const nowMs = quizClock.now();
    const [attemptSnap, draftSnap] = await Promise.all([
      tx.get(attemptRef),
      tx.get(attemptDrafts().doc(attemptRef.id)),
    ]);
    const attempt = attemptSnap.data() as Attempt | undefined;
    if (!attempt) throw new HttpsError("failed-precondition", "Aktif bir sınav girişiniz bulunmuyor.");
    if (attempt.status !== "in_progress") throw new HttpsError("failed-precondition", "Bu sınav zaten teslim edildi.");
    const quizSnap = await tx.get(quizzes().doc(attempt.quizId));

    const deadlineMs = attempt.deadline.toMillis();
    const auto = actor === null;
    const late = !auto && nowMs > deadlineMs + QUIZ_SUBMIT_GRACE_MS;
    const saved = (draftSnap.data() as QuizAttemptDraftDoc<Timestamp> | undefined)?.responses ?? {};
    const responses = auto || late ? saved : (submitted ?? {});
    const graded = gradeAttempt(questions, responses);
    const startedMs = attempt.startedAt.toMillis();

    tx.update(attemptRef, {
      status: "submitted",
      submittedAt: Timestamp.fromMillis(nowMs),
      durationSeconds: Math.max(0, Math.round((Math.min(nowMs, deadlineMs) - startedMs) / 1000)),
      lateSubmission: late,
      autoSubmitted: auto,
      score: graded.score,
      correctCount: graded.correctCount,
      totalQuestions: graded.totalQuestions,
      results: graded.results,
      tabSwitchCount,
    });
    if (draftSnap.exists) tx.delete(draftSnap.ref);
    auditIn(tx, {
      ...(actor ? { actorUid: actor.uid, actorEmail: actor.email } : SYSTEM),
      action: auto ? "QUIZ_ATTEMPT_AUTO_SUBMITTED" : "QUIZ_ATTEMPT_SUBMITTED",
      resourceType: "quizzes",
      resourceId: attempt.quizId,
      severity: late || tabSwitchCount > 0 ? "WARN" : "INFO",
      metadata: { uid: attempt.uid, score: graded.score, lateSubmission: late, tabSwitchCount },
    });
    const quiz = quizSnap.data() as Quiz | undefined;
    const revealed = isRevealed({ ...quiz, revealPolicy: attempt.revealPolicy ?? policyOf(quiz) }, nowMs);
    return { graded, late, revealed, revealAtMs: revealed ? null : revealAtMsFor(quiz) };
  });
}

/** Hekim: yanıtları teslim eder; puanlama sunucuda. Karne politikası açıksa doğru cevaplar ve feedback döner. */
export const submitQuizAttempt = defineCallable("submitQuizAttempt", "member", async (data, actor) => {
  const attemptRef = attempts().doc(attemptIdOf(data.quizId, actor.uid));
  const questions = await loadQuestions(data.quizId);
  const { graded, late, revealed, revealAtMs } = await finalizeAttempt({
    attemptRef,
    questions,
    submitted: data.responses,
    tabSwitchCount: data.tabSwitchCount,
    actor: { uid: actor.uid, email: actor.email },
  });
  return {
    attemptId: attemptRef.id,
    score: graded.score,
    correctCount: graded.correctCount,
    totalQuestions: graded.totalQuestions,
    lateSubmission: late,
    revealed,
    revealAtMs,
    items: buildReport(questions, graded.results, revealed),
  };
});

/** Zamanlayıcı: süresi (+ tolerans) dolmuş, teslim edilmemiş girişimleri kaydedilmiş yanıtlarla teslim eder. */
export async function finalizeExpiredAttempts(nowMs = quizClock.now()): Promise<string[]> {
  const due = await attempts()
    .where("status", "==", "in_progress")
    .where("deadline", "<", Timestamp.fromMillis(nowMs - QUIZ_SUBMIT_GRACE_MS))
    .get();
  const cache = new Map<string, Promise<GradableQuestion[]>>();
  const done: string[] = [];
  for (const doc of due.docs) {
    const quizId = String(doc.data().quizId);
    if (!cache.has(quizId)) cache.set(quizId, loadQuestions(quizId));
    try {
      await finalizeAttempt({ attemptRef: doc.ref, questions: await cache.get(quizId)!, submitted: null, actor: null });
      done.push(doc.id);
    } catch (err) {
      // Arada hekim teslim ettiyse ön koşul tutmaz; atlanır.
      if (!(err instanceof HttpsError && err.code === "failed-precondition")) throw err;
    }
  }
  return done;
}

// --- Karne -----------------------------------------------------------------------------------------

const isAdminActor = (actor: MemberContext) => actor.profile.role === "admin";

/** Girişim sahibi veya admin: karne. Doğru cevap ve feedback yalnızca karne açıksa (D7) ya da admin'e. */
export const getAttemptReport = defineCallable("getAttemptReport", "member", async (data, actor) => {
  const snap = await attempts().doc(data.attemptId).get();
  const attempt = snap.data() as Attempt | undefined;
  // Başkasının girişiminin varlığı da sızmasın: sahibi/admin değilse "bulunamadı".
  if (!attempt || (attempt.uid !== actor.uid && !isAdminActor(actor))) {
    throw new HttpsError("not-found", "Sınav girişimi bulunamadı.");
  }
  if (attempt.status !== "submitted") {
    throw new HttpsError("failed-precondition", "Karne sınav teslim edildikten sonra görüntülenebilir.");
  }
  const [quizSnap, questions] = await Promise.all([quizzes().doc(attempt.quizId).get(), loadQuestions(attempt.quizId)]);
  const quiz = {
    ...(quizSnap.data() as Quiz | undefined),
    revealPolicy: attempt.revealPolicy ?? policyOf(quizSnap.data()),
  };
  const revealed = isAdminActor(actor) || isRevealed(quiz, quizClock.now());
  return {
    attemptId: snap.id,
    quizId: attempt.quizId,
    quizTitle: attempt.quizTitle,
    uid: attempt.uid,
    doctorName: attempt.doctorName,
    submittedAtMs: msOf(attempt.submittedAt) ?? 0,
    autoSubmitted: Boolean(attempt.autoSubmitted),
    score: attempt.score ?? 0,
    correctCount: attempt.correctCount ?? 0,
    totalQuestions: attempt.totalQuestions ?? questions.length,
    lateSubmission: Boolean(attempt.lateSubmission),
    revealed,
    revealAtMs: revealed ? null : revealAtMsFor(quiz),
    items: buildReport(questions, attempt.results ?? [], revealed),
  };
});
