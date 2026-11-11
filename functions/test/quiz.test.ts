import { readFileSync } from "node:fs";
import * as path from "node:path";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeExpiredQuizzes,
  closeQuiz,
  deleteQuizDraft,
  finalizeExpiredAttempts,
  getAttemptReport,
  publishQuiz,
  quizClock,
  saveAttemptDraft,
  saveQuizDraft,
  startQuizAttempt,
  submitQuizAttempt,
  updateQuizDraft,
} from "../src/quizService";
import { QUIZ_SUBMIT_GRACE_MS } from "../src/shared/constants";
import { parseNineFieldQuizCsv } from "../src/shared/quizCsv";
import { CALLABLES } from "../src/shared/schemas";
import { asAdmin, asMember, auditActions, callableRequest, createMember, errorOf, resetEmulators } from "./helpers";

const db = () => getFirestore();
// Testler depo kökünden çalıştırılır (npm run test:functions).
const csv = readFileSync(path.join(process.cwd(), "scripts", "fixtures", "quiz-ornek.csv"), "utf8");
const questions = parseNineFieldQuizCsv(csv).questions;
/** Örnek CSV'nin bütün sorularına doğru yanıt. */
const allCorrect = Object.fromEntries(questions.map((q, i) => [`q_00${i + 1}`, q.correctAnswers.slice()]));

beforeAll(async () => {
  // Örnek CSV `quiz_media/steeple_sign.png`'ye başvurur; sunucu görselin Storage'da olduğunu denetler.
  const png = readFileSync(path.join(process.cwd(), "scripts", "fixtures", "files", "steeple_sign.png"));
  await getStorage()
    .bucket()
    .file("quiz_media/steeple_sign.png")
    .save(png, { contentType: "image/png", resumable: false });
});

beforeEach(async () => {
  await resetEmulators();
  await createMember("admin", "admin", "active");
  await createMember("r1", "user", "active");
  await createMember("r2", "user", "active");
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function draft(extra: Record<string, unknown> = {}) {
  const res = await saveQuizDraft.run(
    callableRequest(
      { title: "Örnek Sınav", durationMinutes: 20, sourceFileName: "quiz-ornek.csv", questions, ...extra },
      asAdmin()
    )
  );
  CALLABLES.saveQuizDraft.response.parse(res);
  return res.quizId;
}

async function publish(quizId: string, extra: Record<string, unknown> = {}) {
  const res = await publishQuiz.run(callableRequest({ quizId, ...extra }, asAdmin()));
  return CALLABLES.publishQuiz.response.parse(res);
}

async function published(extra: Record<string, unknown> = {}) {
  const quizId = await draft(extra);
  expect(await publish(quizId)).toEqual({ published: true, archivedPreviousCount: 0 });
  return quizId;
}

const start = async (quizId: string, uid: string) =>
  CALLABLES.startQuizAttempt.response.parse(await startQuizAttempt.run(callableRequest({ quizId }, asMember(uid))));
const submit = async (quizId: string, uid: string, responses: Record<string, string[]>) =>
  CALLABLES.submitQuizAttempt.response.parse(
    await submitQuizAttempt.run(callableRequest({ quizId, responses }, asMember(uid)))
  );
const saveDraft = (quizId: string, uid: string, responses: Record<string, string[]>) =>
  saveAttemptDraft.run(callableRequest({ quizId, responses }, asMember(uid)));
const report = async (attemptId: string, actor = asMember("r1")) =>
  CALLABLES.getAttemptReport.response.parse(await getAttemptReport.run(callableRequest({ attemptId }, actor)));
const quizDoc = async (id: string) => (await db().doc(`quizzes/${id}`).get()).data();
const attemptDoc = async (quizId: string, uid: string) =>
  (await db().doc(`quiz_attempts/${quizId}_${uid}`).get()).data();
/** Sunucunun saatini ileri alır (süre / kapanış senaryoları). */
const clockAt = (ms: number) => vi.spyOn(quizClock, "now").mockReturnValue(ms);

describe("sınav: soruların teslimi, ara kayıt, teslim (F5.1)", () => {
  it("sorular yalnızca girişimle gelir (cevap anahtarı yok); devamda aynı sorular ve kaydedilmiş yanıtlar döner", async () => {
    expect(questions).toHaveLength(3);
    const quizId = await published();

    const first = await start(quizId, "r1");
    expect(first).toMatchObject({
      attemptId: `${quizId}_r1`,
      resumed: false,
      revealPolicy: "after_close",
      savedResponses: {},
    });
    expect(first.questions.map((q) => q.questionId)).toEqual(["q_001", "q_002", "q_003"]);
    expect(first.questions[0].imagePath).toBe(questions[0].imageUrl);
    for (const q of first.questions) {
      expect(q).not.toHaveProperty("correctAnswers");
      expect(q).not.toHaveProperty("feedbackText");
    }
    expect(JSON.stringify(first)).not.toContain(questions[0].feedbackText);

    expect(await saveDraft(quizId, "r1", { q_001: ["x"] })).toMatchObject({ savedAtMs: expect.any(Number) });
    const resumed = await start(quizId, "r1");
    expect(resumed).toMatchObject({ resumed: true, deadlineMs: first.deadlineMs, savedResponses: { q_001: ["x"] } });
    expect(resumed.questions).toEqual(first.questions);
    expect((await quizDoc(quizId))?.attemptCount).toBe(1);
  });

  it("teslim: sunucu puanlar; girişime doğru cevap/feedback YAZILMAZ; after_close'da karne kapalı", async () => {
    const quizId = await published();
    await start(quizId, "r1");
    await saveDraft(quizId, "r1", { q_001: ["taslak"] });
    const res = await submit(quizId, "r1", {
      q_001: [questions[0].correctAnswers[0]],
      q_002: questions[1].correctAnswers.slice(0, 1), // eksik çoklu seçim → yanlış
      q_003: ["  KRUP  "], // Türkçe büyük/küçük harf duyarsız → doğru
    });
    expect(res).toMatchObject({
      score: 67,
      correctCount: 2,
      totalQuestions: 3,
      lateSubmission: false,
      revealed: false,
    });
    expect(res.items.map((i) => i.isCorrect)).toEqual([true, false, true]);
    expect(res.items.every((i) => i.correctAnswers === null && i.feedbackText === null)).toBe(true);
    expect(res.revealAtMs).toBeNull(); // sınav henüz kapanmadı

    const attempt = await attemptDoc(quizId, "r1");
    expect(attempt).toMatchObject({
      status: "submitted",
      score: 67,
      autoSubmitted: false,
      doctorName: "Asistan Dr. Test r1",
    });
    expect(attempt?.results).toHaveLength(3);
    expect(JSON.stringify(attempt)).not.toContain(questions[0].feedbackText);
    expect(attempt).not.toHaveProperty("gradedReport");
    expect((await db().doc(`quiz_attempt_drafts/${quizId}_r1`).get()).exists).toBe(false);

    const again = await errorOf(start(quizId, "r1"));
    expect(again.code).toBe("already-exists");
    expect(await auditActions()).toEqual(
      expect.arrayContaining([
        "QUIZ_DRAFT_CREATED_FROM_CSV",
        "QUIZ_PUBLISHED",
        "QUIZ_ATTEMPT_STARTED",
        "QUIZ_ATTEMPT_SUBMITTED",
      ])
    );
  });

  it("immediate politikası: teslimde tam karne (doğru cevap + Feedback_Text)", async () => {
    const quizId = await published({ revealPolicy: "immediate" });
    await start(quizId, "r1");
    const res = await submit(quizId, "r1", allCorrect);
    expect(res).toMatchObject({ score: 100, revealed: true, revealAtMs: null });
    expect(res.items[0]).toMatchObject({
      correctAnswers: questions[0].correctAnswers,
      feedbackText: questions[0].feedbackText,
    });
  });

  it("çift teslim: eşzamanlı iki istekten biri geçer; sonraki teslim reddedilir", async () => {
    const quizId = await published();
    await start(quizId, "r1");
    const results = await Promise.allSettled([submit(quizId, "r1", allCorrect), submit(quizId, "r1", {})]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const winner = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ score: number }>;
    expect((await attemptDoc(quizId, "r1"))?.score).toBe(winner.value.score);
    expect(await errorOf(submit(quizId, "r1", allCorrect))).toEqual({
      code: "failed-precondition",
      message: "Bu sınav zaten teslim edildi.",
    });
  });

  it("süre + 30 sn tolerans: içinde teslim geçerli; sonrasında yalnızca süre içinde kaydedilmiş yanıtlar puanlanır", async () => {
    const t0 = Date.now();
    clockAt(t0);
    const quizId = await published();
    const a1 = await start(quizId, "r1");
    const a2 = await start(quizId, "r2");
    await saveDraft(quizId, "r2", { q_001: allCorrect.q_001 }); // süre içinde 1 doğru

    clockAt(a1.deadlineMs + QUIZ_SUBMIT_GRACE_MS - 1000);
    expect(await submit(quizId, "r1", allCorrect)).toMatchObject({ score: 100, lateSubmission: false });

    clockAt(a2.deadlineMs + QUIZ_SUBMIT_GRACE_MS + 1000);
    expect((await errorOf(saveDraft(quizId, "r2", allCorrect))).code).toBe("deadline-exceeded");
    const late = await submit(quizId, "r2", allCorrect);
    expect(late).toMatchObject({ lateSubmission: true, correctCount: 1, score: 33 });
  });

  it("teslim edilmeyen girişimi zamanlayıcı kaydedilmiş yanıtlarla teslim eder", async () => {
    const quizId = await published();
    const a = await start(quizId, "r1");
    await saveDraft(quizId, "r1", allCorrect);
    const b = await start(quizId, "r2"); // hiç kaydı yok
    const last = Math.max(a.deadlineMs, b.deadlineMs);

    expect(await finalizeExpiredAttempts(last)).toEqual([]); // tolerans dolmadı
    const done = await finalizeExpiredAttempts(last + QUIZ_SUBMIT_GRACE_MS + 1);
    expect(done.sort()).toEqual([`${quizId}_r1`, `${quizId}_r2`]);
    expect(await attemptDoc(quizId, "r1")).toMatchObject({ status: "submitted", autoSubmitted: true, score: 100 });
    expect(await attemptDoc(quizId, "r2")).toMatchObject({ status: "submitted", autoSubmitted: true, score: 0 });
    expect(await auditActions()).toContain("QUIZ_ATTEMPT_AUTO_SUBMITTED");
    expect(await finalizeExpiredAttempts(last + QUIZ_SUBMIT_GRACE_MS + 1)).toEqual([]);
  });
});

describe("sınav: karne politikası (D7) ve sızıntı", () => {
  it("after_close: kapanışta süresi süren meslektaş varken karne açılmaz; son girişimin süresi dolunca açılır", async () => {
    const quizId = await published();
    await start(quizId, "r1");
    const a2 = await start(quizId, "r2");
    const sub = await submit(quizId, "r1", allCorrect);
    expect((await report(sub.attemptId)).revealed).toBe(false);

    const closed = CALLABLES.closeQuiz.response.parse(await closeQuiz.run(callableRequest({ quizId }, asAdmin())));
    expect(closed).toMatchObject({
      closed: true,
      inProgressCount: 1,
      revealAtMs: a2.deadlineMs + QUIZ_SUBMIT_GRACE_MS,
    });
    const stillHidden = await report(sub.attemptId);
    expect(stillHidden).toMatchObject({ revealed: false, revealAtMs: closed.revealAtMs });
    expect(JSON.stringify(stillHidden)).not.toContain(questions[0].feedbackText);

    // Kapatılmış sınavda süresi devam eden hekim devam edip teslim edebilir.
    expect((await start(quizId, "r2")).resumed).toBe(true);
    await submit(quizId, "r2", {});

    // Admin her zaman tam karneyi görür.
    expect((await report(sub.attemptId, asAdmin())).revealed).toBe(true);

    clockAt(closed.revealAtMs + 1);
    const open = await report(sub.attemptId);
    expect(open).toMatchObject({ revealed: true, revealAtMs: null, score: 100 });
    expect(open.items[0].feedbackText).toBe(questions[0].feedbackText);
  });

  it("karne: başkasının girişimi 'bulunamadı'; teslim edilmemiş girişim için karne yok", async () => {
    const quizId = await published();
    await start(quizId, "r1");
    expect((await errorOf(report(`${quizId}_r1`))).code).toBe("failed-precondition");
    await submit(quizId, "r1", {});
    expect((await errorOf(report(`${quizId}_r1`, asMember("r2")))).code).toBe("not-found");
    expect((await errorOf(report("yok", asMember("r2")))).code).toBe("not-found");
  });
});

describe("sınav: yayın, kapanış zamanı, zamanlayıcı", () => {
  it("devam eden girişim varken yeni yayın onay ister; force ile yayınlanır, devam eden teslim edebilir", async () => {
    const first = await published();
    await start(first, "r1");
    const second = await draft({ title: "İkinci Sınav" });

    expect(await publish(second)).toEqual({ published: false, inProgressCount: 1, currentQuizTitle: "Örnek Sınav" });
    expect((await quizDoc(second))?.status).toBe("draft");
    expect((await quizDoc(first))?.status).toBe("published");

    expect(await publish(second, { force: true })).toEqual({ published: true, archivedPreviousCount: 1 });
    expect(await quizDoc(first)).toMatchObject({ status: "closed", closeReason: "replaced" });
    const archive = await db().collection("quiz_question_archive").where("sourceQuizId", "==", first).get();
    expect(archive.size).toBe(3);
    expect(archive.docs[0].data()).toHaveProperty("correctAnswers");
    expect((await submit(first, "r1", allCorrect)).score).toBe(100);
    expect((await errorOf(publishQuiz.run(callableRequest({ quizId: second }, asMember("r1"))))).code).toBe(
      "permission-denied"
    );
  });

  it("kapanış zamanı: geçmiş zaman reddedilir; geçince giriş alınmaz ve zamanlayıcı sınavı kapatır", async () => {
    expect(await errorOf(draft({ closesAtMs: Date.now() - 1000 }))).toEqual({
      code: "invalid-argument",
      message: "Kapanış zamanı gelecekte bir an olmalıdır.",
    });
    const closesAtMs = Date.now() + 10 * 60_000; // süre (20 dk) kapanıştan uzun → bitiş kapanışa kırpılır
    const quizId = await published({ closesAtMs });
    expect((await start(quizId, "r1")).deadlineMs).toBe(closesAtMs);

    expect(await closeExpiredQuizzes(closesAtMs - 1)).toEqual([]);
    clockAt(closesAtMs + 1);
    expect((await errorOf(start(quizId, "r2"))).message).toBe("Sınavın kapanış zamanı geçti.");
    expect(await closeExpiredQuizzes(closesAtMs + 1)).toEqual([quizId]);
    expect(await quizDoc(quizId)).toMatchObject({ status: "closed", closeReason: "expired", closedBy: "system" });
    expect(await auditActions()).toContain("QUIZ_CLOSED_AT_DEADLINE");
    expect(await closeExpiredQuizzes(closesAtMs + 1)).toEqual([]);
  });

  it("taslağın kapanış zamanı yayından önce geçtiyse yayın reddedilir", async () => {
    const closesAtMs = Date.now() + 60_000;
    const quizId = await draft({ closesAtMs });
    clockAt(closesAtMs + 1);
    expect((await errorOf(publish(quizId))).message).toBe(
      "Taslağın kapanış zamanı geçmiş; yayınlarken yeni bir zaman seçin."
    );
  });
});

describe("sınav taslağı: güncelleme, silme, görsel kontrolü", () => {
  it("taslak güncellenir (soru seti küçülünce fazlası silinir); yayındaki sınav güncellenemez/silinemez", async () => {
    const quizId = await draft();
    const res = await updateQuizDraft.run(
      callableRequest(
        { quizId, title: "Yeni Başlık", revealPolicy: "immediate", questions: questions.slice(0, 1) },
        asAdmin()
      )
    );
    expect(CALLABLES.updateQuizDraft.response.parse(res)).toEqual({ quizId, questionCount: 1 });
    expect(await quizDoc(quizId)).toMatchObject({ title: "Yeni Başlık", revealPolicy: "immediate", questionCount: 1 });
    expect((await db().collection(`quizzes/${quizId}/questions_public`).get()).size).toBe(1);
    expect((await db().collection(`quiz_answer_keys/${quizId}/items`).get()).size).toBe(1);

    expect((await errorOf(updateQuizDraft.run(callableRequest({ quizId, title: "X" }, asMember("r1"))))).code).toBe(
      "permission-denied"
    );
    await publish(quizId);
    expect((await errorOf(updateQuizDraft.run(callableRequest({ quizId, title: "X" }, asAdmin())))).code).toBe(
      "failed-precondition"
    );
    expect((await errorOf(deleteQuizDraft.run(callableRequest({ quizId }, asAdmin())))).code).toBe(
      "failed-precondition"
    );
  });

  it("taslak silinir (sorular ve cevap anahtarıyla), denetim kaydı düşer", async () => {
    const quizId = await draft();
    expect(await deleteQuizDraft.run(callableRequest({ quizId }, asAdmin()))).toEqual({ deleted: true });
    expect(await quizDoc(quizId)).toBeUndefined();
    expect((await db().collection(`quizzes/${quizId}/questions_public`).get()).size).toBe(0);
    expect((await db().collection(`quiz_answer_keys/${quizId}/items`).get()).size).toBe(0);
    expect(await auditActions()).toContain("QUIZ_DRAFT_DELETED");
    expect((await errorOf(deleteQuizDraft.run(callableRequest({ quizId }, asAdmin())))).code).toBe("not-found");
  });

  it("Storage'da olmayan görsel satır numarasıyla reddedilir; geçersiz soru önizlemeyle aynı mesajla", async () => {
    const missing = [questions[1], { ...questions[0], imageUrl: "quiz_media/yok.png" }];
    const err = await errorOf(draft({ questions: missing }));
    expect(err.code).toBe("invalid-argument");
    expect(err.message).toContain("Satır 3: soru görseli bulunamadı (quiz_media/yok.png).");

    const bad = [questions[0], { ...questions[1], correctAnswers: ["Listede olmayan"] }];
    expect(await errorOf(draft({ questions: bad }))).toEqual({
      code: "invalid-argument",
      message: "Satır 3: Seçeneklerde bulunmuyor: Listede olmayan",
    });
    expect((await db().collection("quizzes").get()).size).toBe(0);
  });
});
