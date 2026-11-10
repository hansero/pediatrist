import { readFileSync } from "node:fs";
import * as path from "node:path";
import { getFirestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { closeQuiz, publishQuiz, saveQuizDraft, startQuizAttempt, submitQuizAttempt } from "../src/quizService";
import { parseNineFieldQuizCsv } from "../src/shared/quizCsv";
import { CALLABLES } from "../src/shared/schemas";
import { asAdmin, asMember, auditActions, callableRequest, createMember, errorOf, resetEmulators } from "./helpers";

const db = () => getFirestore();
// Testler depo kökünden çalıştırılır (npm run test:functions).
const csv = readFileSync(path.join(process.cwd(), "scripts", "fixtures", "quiz-ornek.csv"), "utf8");
const questions = parseNineFieldQuizCsv(csv).questions;

async function publishSample() {
  const draft = await saveQuizDraft.run(
    callableRequest(
      { title: "Örnek Sınav", durationMinutes: 20, sourceFileName: "quiz-ornek.csv", questions },
      asAdmin()
    )
  );
  CALLABLES.saveQuizDraft.response.parse(draft);
  CALLABLES.publishQuiz.response.parse(await publishQuiz.run(callableRequest({ quizId: draft.quizId }, asAdmin())));
  return draft.quizId;
}

beforeEach(async () => {
  await resetEmulators();
  await createMember("admin", "admin", "active");
  await createMember("r1", "user", "active");
});

describe("sınav akışı (sunucu)", () => {
  it("repodaki örnek CSV taslak → yayın → giriş → teslim; puan sunucuda hesaplanır", async () => {
    expect(questions).toHaveLength(3);
    const quizId = await publishSample();

    const answerKeys = await db().collection(`quiz_answer_keys/${quizId}/items`).get();
    const publicQs = await db().collection(`quizzes/${quizId}/questions_public`).get();
    expect(answerKeys.size).toBe(3);
    // Cevap anahtarı public sorulara karışmaz
    for (const d of publicQs.docs) {
      expect(d.data()).not.toHaveProperty("correctAnswers");
      expect(d.data()).not.toHaveProperty("feedbackText");
    }

    const start = await startQuizAttempt.run(callableRequest({ quizId }, asMember("r1")));
    expect(CALLABLES.startQuizAttempt.response.parse(start).resumed).toBe(false);
    const resume = await startQuizAttempt.run(callableRequest({ quizId }, asMember("r1")));
    expect(resume).toEqual({ deadlineMs: start.deadlineMs, resumed: true });

    const responses = {
      q_001: [questions[0].correctAnswers[0]],
      q_002: questions[1].correctAnswers.slice(0, 1), // eksik çoklu seçim → yanlış
      q_003: ["  KRUP  "], // Türkçe büyük/küçük harf duyarsız → doğru
    };
    const graded = await submitQuizAttempt.run(callableRequest({ quizId, responses }, asMember("r1")));
    expect(CALLABLES.submitQuizAttempt.response.parse(graded)).toMatchObject({
      score: 67,
      correctCount: 2,
      totalQuestions: 3,
      lateSubmission: false,
    });
    expect(graded.gradedReport.map((g) => g.isCorrect)).toEqual([true, false, true]);

    const attempt = (await db().doc(`quiz_attempts/${quizId}_r1`).get()).data();
    expect(attempt).toMatchObject({
      status: "submitted",
      score: 67,
      tabSwitchCount: 0,
      doctorName: "Asistan Dr. Test r1",
    });
    expect(await auditActions()).toEqual(
      expect.arrayContaining([
        "QUIZ_DRAFT_CREATED_FROM_CSV",
        "QUIZ_PUBLISHED",
        "QUIZ_ATTEMPT_STARTED",
        "QUIZ_ATTEMPT_SUBMITTED",
      ])
    );

    expect((await errorOf(startQuizAttempt.run(callableRequest({ quizId }, asMember("r1"))))).code).toBe(
      "already-exists"
    );
  });

  it("sunucu, önizlemeyle aynı kurallarla geçersiz soruyu satır numarasıyla reddeder", async () => {
    const bad = [questions[0], { ...questions[1], correctAnswers: ["Listede olmayan"] }];
    const err = await errorOf(
      saveQuizDraft.run(callableRequest({ title: "S", durationMinutes: 10, questions: bad }, asAdmin()))
    );
    expect(err.code).toBe("invalid-argument");
    expect(err.message).toBe("Satır 3: Seçeneklerde bulunmuyor: Listede olmayan");
    expect((await db().collection("quizzes").get()).size).toBe(0);
  });

  it("geçmiş kapanış zamanı kabul edilmez", async () => {
    const err = await errorOf(
      saveQuizDraft.run(
        callableRequest({ title: "S", durationMinutes: 10, closesAtMs: Date.now() - 1000, questions }, asAdmin())
      )
    );
    expect(err).toEqual({ code: "invalid-argument", message: "Kapanış zamanı gelecekte bir an olmalıdır." });
  });

  it("yeni yayın öncekini kapatıp arşivler; asistan sınav yayımlayamaz", async () => {
    const first = await publishSample();
    const second = await publishSample();
    expect((await db().doc(`quizzes/${first}`).get()).data()?.status).toBe("closed");
    expect((await db().doc(`quizzes/${second}`).get()).data()?.status).toBe("published");
    const archive = await db().collection("quiz_question_archive").where("sourceQuizId", "==", first).get();
    expect(archive.size).toBe(3);
    expect(archive.docs[0].data()).toHaveProperty("correctAnswers");

    CALLABLES.closeQuiz.response.parse(await closeQuiz.run(callableRequest({ quizId: second }, asAdmin())));
    expect((await errorOf(publishQuiz.run(callableRequest({ quizId: second }, asMember("r1"))))).code).toBe(
      "permission-denied"
    );
  });
});
