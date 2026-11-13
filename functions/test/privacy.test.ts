import { readFileSync } from "node:fs";
import * as path from "node:path";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { endLectureSession, markAttendanceExcused, startLectureSession } from "../src/attendanceService";
import { completeRegistration } from "../src/members";
import { acceptConsent, deleteMember, exportMemberData } from "../src/privacyService";
import { publishQuiz, saveQuizDraft, startQuizAttempt, submitQuizAttempt } from "../src/quizService";
import { KVKK_NOTICE_VERSION } from "../src/shared/consent";
import { DELETED_MEMBER_NAME } from "../src/shared/constants";
import { parseNineFieldQuizCsv } from "../src/shared/quizCsv";
import { CALLABLES } from "../src/shared/schemas";
import { asAdmin, asMember, auditActions, callableRequest, createMember, errorOf, resetEmulators } from "./helpers";

const db = () => getFirestore();
const csv = readFileSync(path.join(process.cwd(), "scripts", "fixtures", "quiz-ornek.csv"), "utf8");
const questions = parseNineFieldQuizCsv(csv).questions;
const allCorrect = Object.fromEntries(questions.map((q, i) => [`q_00${i + 1}`, q.correctAnswers.slice()]));

beforeAll(async () => {
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

/** r1 için gerçek callable'larla kayıt üretir: teslim edilmiş sınav, mazeretli yoklama, materyal ilerlemesi, davet. */
async function populate(uid = "r1") {
  const { quizId } = await saveQuizDraft.run(
    callableRequest(
      { title: "Örnek Sınav", durationMinutes: 20, sourceFileName: "quiz-ornek.csv", questions },
      asAdmin()
    )
  );
  await publishQuiz.run(callableRequest({ quizId }, asAdmin()));
  await startQuizAttempt.run(callableRequest({ quizId }, asMember(uid)));
  await submitQuizAttempt.run(callableRequest({ quizId, responses: allCorrect }, asMember(uid)));

  const { sessionId } = await startLectureSession.run(
    callableRequest({ title: "Sabah Dersi", lecturer: "Dr. X", durationMinutes: 15 }, asAdmin())
  );
  await markAttendanceExcused.run(
    callableRequest({ sessionId, targetUid: uid, excuseNote: "Sağlık raporu" }, asAdmin())
  );
  await endLectureSession.run(callableRequest({ sessionId }, asAdmin()));

  await db()
    .doc("materials/m1")
    .set({ title: "Sepsis", status: "published", uploadedBy: "admin", uploadedByName: "Prof. Dr. Test admin" });
  await db()
    .doc(`materials/m1/progress/${uid}`)
    .set({ uid, secondsSpent: 120, lastPage: 3, completed: true, updatedAt: Timestamp.now() });
  await db()
    .doc("invitations/used")
    .set({ code: "USED1", email: `${uid}@example.test`, used: true, usedBy: uid, intendedRole: "user" });
  await db()
    .doc("invitations/unused")
    .set({ code: "NEW1", email: `${uid}@example.test`, used: false, intendedRole: "user" });
  return { quizId, sessionId };
}

describe("acceptConsent (F9.1)", () => {
  it("güncel sürüm onayı sürüm + zamanla kaydedilir ve denetim kaydı düşer; eski sürüm reddedilir", async () => {
    const res = await acceptConsent.run(callableRequest({ consentVersion: KVKK_NOTICE_VERSION }, asMember("r1")));
    expect(CALLABLES.acceptConsent.response.parse(res)).toEqual({ accepted: true, version: KVKK_NOTICE_VERSION });
    const consent = (await db().doc("users/r1").get()).data()?.consent;
    expect(consent.version).toBe(KVKK_NOTICE_VERSION);
    expect(consent.acceptedAt).toBeInstanceOf(Timestamp);
    expect(await auditActions()).toContain("MEMBER_CONSENT_ACCEPTED");

    const stale = await errorOf(acceptConsent.run(callableRequest({ consentVersion: "0.1" }, asMember("r1"))));
    expect(stale.code).toBe("invalid-argument");
    expect(stale.message).toContain("Aydınlatma metni güncellendi");
  });
});

describe("deleteMember (F9.1)", () => {
  it("hesap ve profil silinir; kayıtlar addan arındırılır ama istatistik kalır; kimlik içermeyen denetim kaydı", async () => {
    const { quizId, sessionId } = await populate();
    const res = await deleteMember.run(callableRequest({ targetUid: "r1" }, asAdmin()));
    expect(CALLABLES.deleteMember.response.parse(res)).toEqual({
      deleted: true,
      anonymized: { quizAttempts: 1, attendanceRecords: 1, authoredItems: 0 },
      removed: { materialProgress: 1, invitations: 1 },
    });

    // Giriş hesabı ve profil yok.
    await expect(getAuth().getUser("r1")).rejects.toMatchObject({ code: "auth/user-not-found" });
    expect((await db().doc("users/r1").get()).exists).toBe(false);

    // Sınav girişimi: puan duruyor, ad yok.
    const attempt = (await db().doc(`quiz_attempts/${quizId}_r1`).get()).data();
    expect(attempt).toMatchObject({ doctorName: DELETED_MEMBER_NAME, score: 100, uid: "r1" });
    // Yoklama: durum duruyor; ad, ünvan ve mazeret notu (sağlık bilgisi olabilir) yok.
    for (const p of [`attendance_logs/${sessionId}_r1`, `attendance_sessions/${sessionId}/records/r1`]) {
      const d = (await db().doc(p).get()).data();
      expect(d).toMatchObject({ fullName: DELETED_MEMBER_NAME, title: "", status: "excused" });
      expect(d).not.toHaveProperty("excuseNote");
    }
    // Materyal ilerlemesi ve kullanılmamış davet silindi; kullanılan davetten e-posta çıkarıldı.
    expect((await db().doc("materials/m1/progress/r1").get()).exists).toBe(false);
    expect((await db().doc("invitations/unused").get()).exists).toBe(false);
    expect((await db().doc("invitations/used").get()).data()?.email).toBe(DELETED_MEMBER_NAME);

    // Başka üyenin verisine dokunulmadı.
    expect((await db().doc("users/r2").get()).data()?.fullName).toBe("Test r2");

    const audit = (await db().collection("audit_logs").where("action", "==", "MEMBER_DELETED").get()).docs[0].data();
    expect(audit).toMatchObject({ resourceId: "r1", severity: "CRITICAL", actorUid: "admin" });
    expect(JSON.stringify(audit.metadata)).not.toMatch(/Test r1|r1@example\.test/);
  });

  it("silinen admin'in içerik imzaları da addan arındırılır", async () => {
    await createMember("admin2", "admin", "active");
    await db()
      .doc("materials/m2")
      .set({ title: "Kılavuz", status: "published", uploadedBy: "admin2", uploadedByName: "Prof. Dr. Test admin2" });
    await db()
      .doc("calculators_config/calc_holliday_segar")
      .set({ protocolNote: "x", updatedBy: "admin2", updatedByName: "Prof. Dr. Test admin2" });
    const res = await deleteMember.run(callableRequest({ targetUid: "admin2" }, asAdmin()));
    expect(res.anonymized.authoredItems).toBe(2);
    expect((await db().doc("materials/m2").get()).data()?.uploadedByName).toBe(DELETED_MEMBER_NAME);
    expect((await db().doc("calculators_config/calc_holliday_segar").get()).data()?.updatedByName).toBe(
      DELETED_MEMBER_NAME
    );
  });

  it("kendi hesabını silemez; hekim silemez; olmayan üye bulunamadı; yarım kalmış silme yeniden çalıştırılabilir", async () => {
    expect((await errorOf(deleteMember.run(callableRequest({ targetUid: "admin" }, asAdmin())))).code).toBe(
      "failed-precondition"
    );
    expect((await errorOf(deleteMember.run(callableRequest({ targetUid: "r2" }, asMember("r1"))))).code).toBe(
      "permission-denied"
    );
    expect((await errorOf(deleteMember.run(callableRequest({ targetUid: "yok" }, asAdmin())))).code).toBe("not-found");
    expect((await db().doc("users/r2").get()).exists).toBe(true);

    // Giriş hesabı önceki denemede silinmiş, profil kalmış: işlem yine tamamlanır.
    await getAuth().deleteUser("r2");
    const res = await deleteMember.run(callableRequest({ targetUid: "r2" }, asAdmin()));
    expect(res.deleted).toBe(true);
    expect((await db().doc("users/r2").get()).exists).toBe(false);
  });

  it("silinen üye, süresi dolmamış oturum belirteciyle profilini yeniden oluşturamaz", async () => {
    await deleteMember.run(callableRequest({ targetUid: "r1" }, asAdmin()));
    const err = await errorOf(
      completeRegistration.run(
        callableRequest(
          { title: "Asistan Dr.", fullName: "Test r1", residencyYear: 1, consentVersion: KVKK_NOTICE_VERSION },
          { uid: "r1", claims: { email: "r1@example.test" } }
        )
      )
    );
    expect(err.code).toBe("unauthenticated");
    expect((await db().doc("users/r1").get()).exists).toBe(false);
  });
});

describe("exportMemberData (F9.1)", () => {
  it("üye kendi verisini alır: profil, sınav (kendi yanıtları), yoklama, materyal, işlemler; cevap anahtarı yok", async () => {
    await populate();
    await acceptConsent.run(callableRequest({ consentVersion: KVKK_NOTICE_VERSION }, asMember("r1")));
    const res = CALLABLES.exportMemberData.response.parse(
      await exportMemberData.run(callableRequest({ targetUid: "r1" }, asMember("r1")))
    );
    expect(res.profile).toMatchObject({ uid: "r1", fullName: "Test r1", email: "r1@example.test", role: "user" });
    expect(res.profile.consent?.version).toBe(KVKK_NOTICE_VERSION);
    expect(res.profile).not.toHaveProperty("attendanceDeviceRegisteredAt");
    expect(res.quizAttempts).toHaveLength(1);
    expect(res.quizAttempts[0]).toMatchObject({ quizTitle: "Örnek Sınav", status: "submitted", score: 100 });
    expect(res.quizAttempts[0].answers).toHaveLength(questions.length);
    expect(res.quizAttempts[0].answers[0]).toMatchObject({ question: 1, isCorrect: true });
    expect(res.attendance).toEqual([
      expect.objectContaining({ lectureTitle: "Sabah Dersi", status: "excused", excuseNote: "Sağlık raporu" }),
    ]);
    expect(res.materialProgress).toEqual([
      expect.objectContaining({ materialTitle: "Sepsis", secondsSpent: 120, lastPage: 3, completed: true }),
    ]);
    expect(res.activity.map((a) => a.action)).toContain("MEMBER_CONSENT_ACCEPTED");
    expect(res.truncated).toBe(false);
    // Kural 5: doğru cevaplar ve açıklama metni dökümde bulunmaz.
    const text = JSON.stringify(res);
    expect(text).not.toContain("correctAnswers");
    expect(text).not.toContain("feedbackText");
    for (const q of questions) expect(text).not.toContain(q.feedbackText);
    expect(await auditActions()).toContain("MEMBER_DATA_EXPORTED");
  });

  it("admin her üyenin verisini alır; hekim başkasınınkini alamaz; olmayan üye bulunamadı", async () => {
    const res = await exportMemberData.run(callableRequest({ targetUid: "r1" }, asAdmin()));
    expect(res.profile.uid).toBe("r1");
    const denied = await errorOf(exportMemberData.run(callableRequest({ targetUid: "r2" }, asMember("r1"))));
    expect(denied).toMatchObject({
      code: "permission-denied",
      message: "Yalnızca kendi verilerinizi indirebilirsiniz.",
    });
    expect((await errorOf(exportMemberData.run(callableRequest({ targetUid: "yok" }, asAdmin())))).code).toBe(
      "not-found"
    );
  });
});
