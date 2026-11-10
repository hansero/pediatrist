import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type Firestore,
  type WriteBatch,
  type DocumentSnapshot,
} from "firebase-admin/firestore";
import { writeAuditLog } from "./auditLogger";
import { QUESTION_TYPES, QUIZ_SUBMIT_GRACE_MS, REGION, type QuestionType } from "./shared/constants";

/**
 * MODÜL 4 — ONLINE QUIZ (Sunucu Tarafı)
 *
 * Yaşam döngüsü:  draft ──publishQuiz──▶ published ──closeQuiz / yeni yayın──▶ closed
 *
 *  - Admin CSV'yi tarayıcıda ayrıştırır ve önizler, ardından `saveQuizDraft` ile taslak oluşturur.
 *    Sunucu 9 alanı YENİDEN doğrular (istemci doğrulamasına güvenilmez).
 *  - `publishQuiz`: Admin süreyi (dk) belirler; varsa mevcut yayındaki sınav kapatılır ve
 *    soruları 9 alanıyla `quiz_question_archive` koleksiyonuna taşınır.
 *  - Hekim `startQuizAttempt` ile sınava girer → sunucu başlangıç zamanını ve bitiş sınırını kaydeder.
 *  - `submitQuizAttempt`: süre sınırı (+30 sn tolerans) sunucuda denetlenir, puanlama sunucuda yapılır.
 *  - 8. (Doğru Seçenek) ve 9. (Feedback_Text) alanlar `quiz_answer_keys` içinde, istemciye kapalıdır.
 */

export interface NineFieldQuestionInput {
  caseContent: string; // 1. Soru İçeriği
  imageUrl?: string; // 2. Soru Görseli
  questionText: string; // 3. Sorunun Kendi
  questionType: QuestionType; // 4. Soru Tipi
  maxLength?: number; // 5. Maximum Length
  optionsRaw?: string; // 6. Seçenekler ( | ile)
  optionsArray?: string[]; // 7. Seçenekler (JSON Array)
  correctAnswers: string[]; // 8. Doğru Seçenek (JSON Array)
  feedbackText: string; // 9. Feedback_Text
}

function assertAdmin(request: CallableRequest<unknown>) {
  if (!request.auth || request.auth.token.role !== "admin" || request.auth.token.status !== "active") {
    throw new HttpsError("permission-denied", "Bu işlem yalnızca aktif Admin yetkisiyle yapılabilir.");
  }
  return request.auth;
}

function assertActiveMember(request: CallableRequest<unknown>) {
  if (!request.auth || request.auth.token.status !== "active") {
    throw new HttpsError("permission-denied", "Sadece aktif üyeler sınava katılabilir.");
  }
  return request.auth;
}

const norm = (v: string) =>
  String(v ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
const clip = (v: unknown, max: number) => String(v ?? "").slice(0, max);

/** 9 alanlı soruyu sunucuda doğrular ve normalize eder. Hata varsa satır numarasıyla fırlatır. */
function sanitizeQuestion(q: NineFieldQuestionInput, row: number) {
  const fail = (msg: string) => {
    throw new HttpsError("invalid-argument", `Satır ${row}: ${msg}`);
  };
  if (!q || typeof q !== "object") fail("Geçersiz soru.");
  if (!String(q.caseContent ?? "").trim()) fail("1. alan (Soru İçeriği) boş.");
  if (!String(q.questionText ?? "").trim()) fail("3. alan (Sorunun Kendi) boş.");
  if (!QUESTION_TYPES.includes(q.questionType)) fail("4. alan (Soru Tipi) geçersiz.");
  if (!String(q.feedbackText ?? "").trim()) fail("9. alan (Feedback_Text) boş.");
  if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) fail("8. alan (Doğru Seçenek) boş.");

  const options =
    Array.isArray(q.optionsArray) && q.optionsArray.length > 0
      ? q.optionsArray.map((o) => clip(o, 500).trim()).filter(Boolean)
      : String(q.optionsRaw ?? "")
          .split("|")
          .map((s) => clip(s, 500).trim())
          .filter(Boolean);

  const correct = q.correctAnswers.map((c) => clip(c, 500).trim()).filter(Boolean);
  let maxLength = 0;

  if (q.questionType === "Text Input") {
    maxLength = Number(q.maxLength);
    if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 2000)
      fail("5. alan (Maximum Length) 1–2000 olmalı.");
  } else {
    if (options.length < 2) fail("Seçenekli sorularda en az 2 seçenek gerekir.");
    const optSet = new Set(options.map(norm));
    if (correct.some((c) => !optSet.has(norm(c)))) fail("Doğru seçenek, seçenekler arasında yok.");
    if (q.questionType === "Single Choice" && correct.length !== 1) fail("Single Choice tam 1 doğru seçenek içermeli.");
  }

  return {
    publicPart: {
      caseContent: clip(q.caseContent, 5000),
      imageUrl: clip(q.imageUrl, 1000),
      questionText: clip(q.questionText, 2000),
      questionType: q.questionType,
      maxLength,
      optionsRaw: options.join(" | "),
      optionsArray: options,
    },
    privatePart: { correctAnswers: correct, feedbackText: clip(q.feedbackText, 5000) },
  };
}

/** Admin: CSV'den önizlenen soruları taslak sınav olarak kaydeder (henüz hekimlere görünmez). */
export const saveQuizDraft = onCall({ enforceAppCheck: true, region: REGION }, async (request) => {
  const auth = assertAdmin(request);
  const { title, durationMinutes, closesAtMs, sourceFileName, questions } = (request.data ?? {}) as {
    title?: string;
    durationMinutes?: number;
    closesAtMs?: number | null;
    sourceFileName?: string;
    questions?: NineFieldQuestionInput[];
  };

  if (!title?.trim()) throw new HttpsError("invalid-argument", "Sınav başlığı zorunludur.");
  if (!Array.isArray(questions) || questions.length === 0 || questions.length > 200) {
    throw new HttpsError("invalid-argument", "Sınav 1–200 arası soru içermelidir.");
  }
  const duration = Number(durationMinutes);
  if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
    throw new HttpsError("invalid-argument", "Sınav süresi 1–180 dk arasında olmalıdır.");
  }

  const sanitized = questions.map((q, i) => sanitizeQuestion(q, i + 2)); // +2: CSV başlık satırı

  const db = getFirestore();
  const quizRef = db.collection("quizzes").doc();
  const batch = db.batch();
  batch.set(quizRef, {
    title: clip(title, 200).trim(),
    status: "draft",
    durationMinutes: duration,
    closesAt: closesAtMs ? Timestamp.fromMillis(Number(closesAtMs)) : null,
    questionCount: sanitized.length,
    sourceFileName: clip(sourceFileName, 200),
    createdAt: FieldValue.serverTimestamp(),
    createdBy: auth.uid,
    attemptCount: 0,
  });
  sanitized.forEach((s, idx) => {
    const qId = `q_${String(idx + 1).padStart(3, "0")}`;
    batch.set(quizRef.collection("questions_public").doc(qId), { orderIndex: idx + 1, ...s.publicPart });
    batch.set(db.collection("quiz_answer_keys").doc(quizRef.id).collection("items").doc(qId), s.privatePart);
  });
  await batch.commit();

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.token.email ?? "unknown",
    action: "QUIZ_DRAFT_CREATED_FROM_CSV",
    resourceType: "quizzes",
    resourceId: quizRef.id,
    metadata: { questionCount: sanitized.length, sourceFileName: clip(sourceFileName, 200) },
  });

  return { quizId: quizRef.id, questionCount: sanitized.length };
});

/** Bir sınavı kapatır ve 9 alanlı sorularını kayıp önleyici arşive taşır (batch'e ekler). */
async function closeAndArchive(db: Firestore, batch: WriteBatch, quizDoc: DocumentSnapshot, actorUid: string) {
  const [pubSnap, keySnap] = await Promise.all([
    quizDoc.ref.collection("questions_public").get(),
    db.collection("quiz_answer_keys").doc(quizDoc.id).collection("items").get(),
  ]);
  const keys = new Map(keySnap.docs.map((d) => [d.id, d.data()]));
  pubSnap.docs.forEach((qDoc) => {
    const pub = qDoc.data();
    const priv = keys.get(qDoc.id) ?? { correctAnswers: [], feedbackText: "" };
    batch.set(db.collection("quiz_question_archive").doc(), {
      sourceQuizId: quizDoc.id,
      sourceQuizTitle: quizDoc.data()?.title ?? "",
      archivedAt: FieldValue.serverTimestamp(),
      archivedBy: actorUid,
      ...pub,
      correctAnswers: priv.correctAnswers,
      feedbackText: priv.feedbackText,
    });
  });
  batch.update(quizDoc.ref, { status: "closed", closedAt: FieldValue.serverTimestamp() });
}

/** Admin: taslağı yayına alır. Süreyi son kez burada belirleyebilir. */
export const publishQuiz = onCall({ enforceAppCheck: true, region: REGION }, async (request) => {
  const auth = assertAdmin(request);
  const { quizId, durationMinutes, closesAtMs } = (request.data ?? {}) as {
    quizId?: string;
    durationMinutes?: number;
    closesAtMs?: number | null;
  };
  if (!quizId) throw new HttpsError("invalid-argument", "Sınav kimliği zorunludur.");

  const db = getFirestore();
  const quizRef = db.collection("quizzes").doc(quizId);
  const quizSnap = await quizRef.get();
  if (!quizSnap.exists || quizSnap.data()?.status !== "draft") {
    throw new HttpsError("failed-precondition", "Yalnızca taslak durumundaki sınavlar yayına alınabilir.");
  }

  const duration = durationMinutes ?? quizSnap.data()?.durationMinutes;
  if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
    throw new HttpsError("invalid-argument", "Sınav süresi 1–180 dk arasında olmalıdır.");
  }

  const batch = db.batch();
  const currentlyPublished = await db.collection("quizzes").where("status", "==", "published").get();
  for (const doc of currentlyPublished.docs) {
    await closeAndArchive(db, batch, doc, auth.uid);
  }
  batch.update(quizRef, {
    status: "published",
    durationMinutes: duration,
    closesAt: closesAtMs ? Timestamp.fromMillis(Number(closesAtMs)) : (quizSnap.data()?.closesAt ?? null),
    publishedAt: FieldValue.serverTimestamp(),
    publishedBy: auth.uid,
  });
  await batch.commit();

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.token.email ?? "unknown",
    action: "QUIZ_PUBLISHED",
    resourceType: "quizzes",
    resourceId: quizId,
    metadata: { durationMinutes: duration, closedAndArchived: currentlyPublished.size },
  });

  return { published: true, archivedPreviousCount: currentlyPublished.size };
});

/** Admin: yayındaki sınavı kapatır ve arşivler. */
export const closeQuiz = onCall({ enforceAppCheck: true, region: REGION }, async (request) => {
  const auth = assertAdmin(request);
  const { quizId } = (request.data ?? {}) as { quizId?: string };
  if (!quizId) throw new HttpsError("invalid-argument", "Sınav kimliği zorunludur.");

  const db = getFirestore();
  const quizSnap = await db.collection("quizzes").doc(quizId).get();
  if (!quizSnap.exists || quizSnap.data()?.status !== "published") {
    throw new HttpsError("failed-precondition", "Yalnızca yayındaki sınav kapatılabilir.");
  }
  const batch = db.batch();
  await closeAndArchive(db, batch, quizSnap, auth.uid);
  await batch.commit();

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.token.email ?? "unknown",
    action: "QUIZ_CLOSED_AND_ARCHIVED",
    resourceType: "quizzes",
    resourceId: quizId,
  });
  return { closed: true };
});

/** Hekim: yayındaki sınava girer. Her hekim her sınava bir kez girebilir; yarıda kalan giriş devam ettirilir. */
export const startQuizAttempt = onCall({ enforceAppCheck: true, region: REGION }, async (request) => {
  const auth = assertActiveMember(request);
  const { quizId } = (request.data ?? {}) as { quizId?: string };
  if (!quizId) throw new HttpsError("invalid-argument", "Sınav kimliği zorunludur.");

  const db = getFirestore();
  const quizSnap = await db.collection("quizzes").doc(quizId).get();
  const quiz = quizSnap.data();
  if (!quiz || quiz.status !== "published")
    throw new HttpsError("failed-precondition", "Bu sınav şu anda aktif değil.");

  const nowMs = Date.now();
  const closesAtMs = quiz.closesAt ? (quiz.closesAt as Timestamp).toMillis() : null;
  if (closesAtMs && closesAtMs <= nowMs) throw new HttpsError("failed-precondition", "Sınavın kapanış zamanı geçti.");

  const attemptRef = db.collection("quiz_attempts").doc(`${quizId}_${auth.uid}`);
  const result = await db.runTransaction(async (tx) => {
    const existing = await tx.get(attemptRef);
    if (existing.exists) {
      const data = existing.data()!;
      if (data.status === "submitted") throw new HttpsError("already-exists", "Bu sınavı zaten tamamladınız.");
      return { deadlineMs: (data.deadline as Timestamp).toMillis(), resumed: true };
    }
    const userSnap = await tx.get(db.collection("users").doc(auth.uid));
    const user = userSnap.data() ?? {};
    let deadlineMs = nowMs + Number(quiz.durationMinutes) * 60_000;
    if (closesAtMs) deadlineMs = Math.min(deadlineMs, closesAtMs);

    tx.set(attemptRef, {
      quizId,
      quizTitle: quiz.title,
      uid: auth.uid,
      doctorName: `${user.title ?? ""} ${user.fullName ?? ""}`.trim() || (auth.token.email ?? ""),
      residencyYear: user.residencyYear ?? 1,
      status: "in_progress",
      startedAt: Timestamp.fromMillis(nowMs),
      deadline: Timestamp.fromMillis(deadlineMs),
      durationMinutes: quiz.durationMinutes,
    });
    tx.update(quizSnap.ref, { attemptCount: FieldValue.increment(1) });
    return { deadlineMs, resumed: false };
  });

  if (!result.resumed) {
    await writeAuditLog({
      actorUid: auth.uid,
      actorEmail: auth.token.email ?? "unknown",
      action: "QUIZ_ATTEMPT_STARTED",
      resourceType: "quizzes",
      resourceId: quizId,
    });
  }
  return result;
});

/** Hekim: yanıtları gönderir; puanlama ve Feedback_Text karnesi sunucuda üretilir. */
export const submitQuizAttempt = onCall({ enforceAppCheck: true, region: REGION }, async (request) => {
  const auth = assertActiveMember(request);
  const { quizId, responses, tabSwitchCount } = (request.data ?? {}) as {
    quizId?: string;
    responses?: Record<string, string[]>;
    tabSwitchCount?: number;
  };
  if (!quizId || typeof responses !== "object" || responses === null) {
    throw new HttpsError("invalid-argument", "Sınav kimliği ve yanıtlar zorunludur.");
  }

  const db = getFirestore();
  const attemptRef = db.collection("quiz_attempts").doc(`${quizId}_${auth.uid}`);
  const attemptSnap = await attemptRef.get();
  const attempt = attemptSnap.data();
  if (!attempt || attempt.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Aktif bir sınav girişiniz bulunmuyor.");
  }

  const nowMs = Date.now();
  const deadlineMs = (attempt.deadline as Timestamp).toMillis();
  const lateSubmission = nowMs > deadlineMs + QUIZ_SUBMIT_GRACE_MS;

  const [pubSnap, keySnap] = await Promise.all([
    db.collection("quizzes").doc(quizId).collection("questions_public").orderBy("orderIndex").get(),
    db.collection("quiz_answer_keys").doc(quizId).collection("items").get(),
  ]);
  const keys = new Map(keySnap.docs.map((d) => [d.id, d.data() as { correctAnswers: string[]; feedbackText: string }]));

  let correctCount = 0;
  const gradedReport = pubSnap.docs.map((qDoc) => {
    const q = qDoc.data();
    const key = keys.get(qDoc.id) ?? { correctAnswers: [], feedbackText: "" };
    // Süre aşımında yanıtlar değerlendirmeye alınmaz (0 puan) ama karne yine gösterilir.
    const userRes = lateSubmission
      ? []
      : (Array.isArray(responses[qDoc.id]) ? responses[qDoc.id] : []).map((r) => clip(r, q.maxLength || 500));

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

  await attemptRef.update({
    status: "submitted",
    submittedAt: Timestamp.fromMillis(nowMs),
    durationSeconds: Math.round((Math.min(nowMs, deadlineMs) - startedMs) / 1000),
    lateSubmission,
    score,
    correctCount,
    totalQuestions,
    gradedReport,
    tabSwitchCount: Math.max(0, Math.min(Number(tabSwitchCount) || 0, 999)),
  });

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.token.email ?? "unknown",
    action: "QUIZ_ATTEMPT_SUBMITTED",
    resourceType: "quizzes",
    resourceId: quizId,
    severity: lateSubmission || Number(tabSwitchCount) > 0 ? "WARN" : "INFO",
    metadata: { score, lateSubmission, tabSwitchCount: Number(tabSwitchCount) || 0 },
  });

  return { score, correctCount, totalQuestions, gradedReport, lateSubmission };
});
