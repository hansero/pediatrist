import { getFirestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { startQuizAttempt } from "../src/quizService";
import { startLectureSession } from "../src/attendanceService";
import { isEnforced } from "../src/guards";
import { ENFORCE_APP_CHECK } from "../src/config";
import {
  asAdmin,
  asMember,
  callableRequest,
  createMember,
  errorOf,
  resetEmulators,
  setSecurityConfig,
  withEnforced,
} from "./helpers";

/**
 * guards.ts: yetkinin kaynağı `users/{uid}` dokümanıdır (D3). Testler, iş mantığına ulaşmadan önce
 * reddedilmesi gereken durumları ve iş mantığına ulaşıldığını (farklı hata kodu) ayırt eder.
 */
const lecture = { title: "Ders", lecturer: "Dr. X", durationMinutes: 10 };

beforeEach(async () => {
  await resetEmulators();
});

describe("isEnforced (güvenli varsayılan)", () => {
  it("değişken yoksa veya 'true' ise zorunluluk açık, yalnızca 'false' kapatır", () => {
    delete process.env.ENFORCE_APP_CHECK;
    expect(isEnforced(ENFORCE_APP_CHECK)).toBe(true);
    process.env.ENFORCE_APP_CHECK = "true";
    expect(isEnforced(ENFORCE_APP_CHECK)).toBe(true);
    process.env.ENFORCE_APP_CHECK = "false";
    expect(isEnforced(ENFORCE_APP_CHECK)).toBe(false);
  });
});

describe("üyelik durumu dokümandan okunur", () => {
  it("C5: askıya alınmış üye, token'ında eski 'active' claim olsa da reddedilir", async () => {
    await createMember("u1", "user", "suspended");
    const err = await errorOf(startQuizAttempt.run(callableRequest({ quizId: "q1" }, asMember("u1"))));
    expect(err).toEqual({ code: "permission-denied", message: expect.stringContaining("askıya alınmış") });
  });

  it("onay bekleyen ve profili olmayan kullanıcı reddedilir", async () => {
    await createMember("u1", "user", "pending");
    expect((await errorOf(startQuizAttempt.run(callableRequest({ quizId: "q1" }, asMember("u1"))))).code).toBe(
      "permission-denied"
    );
    expect((await errorOf(startQuizAttempt.run(callableRequest({ quizId: "q1" }, asMember("hayalet"))))).message).toBe(
      "Üyelik kaydınız bulunamadı."
    );
  });

  it("claim'de admin yazsa da dokümanda 'user' olan kullanıcı admin işlemi yapamaz", async () => {
    await createMember("u1", "user", "active");
    const err = await errorOf(startLectureSession.run(callableRequest(lecture, asAdmin("u1"))));
    expect(err.code).toBe("permission-denied");
  });

  it("tokensValidAfter'dan önce açılmış oturum reddedilir, sonrası kabul edilir", async () => {
    const now = Math.floor(Date.now() / 1000);
    await createMember("u1", "user", "active", { tokensValidAfter: now });
    const old = { ...asMember("u1"), claims: { ...asMember("u1").claims, auth_time: now - 60 } };
    expect((await errorOf(startQuizAttempt.run(callableRequest({ quizId: "q1" }, old)))).code).toBe("unauthenticated");
    const fresh = { ...asMember("u1"), claims: { ...asMember("u1").claims, auth_time: now + 5 } };
    // Yetki geçti → iş mantığı: sınav yok
    expect((await errorOf(startQuizAttempt.run(callableRequest({ quizId: "q1" }, fresh)))).code).toBe(
      "failed-precondition"
    );
  });
});

describe("parametreyle yönetilen zorunluluklar", () => {
  it("App Check zorunluysa token'sız çağrı reddedilir, token'lı çağrı geçer", async () => {
    withEnforced("ENFORCE_APP_CHECK");
    await createMember("admin", "admin", "active");
    expect((await errorOf(startLectureSession.run(callableRequest(lecture, asAdmin())))).code).toBe("unauthenticated");
    const res = await startLectureSession.run(callableRequest(lecture, { ...asAdmin(), app: true }));
    expect(res.sessionId).toBeTruthy();
  });

  it("MFA zorunluysa (config/security) ikinci faktörsüz oturum reddedilir", async () => {
    await setSecurityConfig({ requireMfa: true });
    await createMember("u1", "user", "active");
    const noMfa = await errorOf(startQuizAttempt.run(callableRequest({ quizId: "q1" }, asMember("u1"))));
    expect(noMfa).toEqual({ code: "permission-denied", message: expect.stringContaining("iki aşamalı") });
    const mfa = {
      ...asMember("u1"),
      claims: { ...asMember("u1").claims, firebase: { sign_in_second_factor: "totp" } },
    };
    expect((await errorOf(startQuizAttempt.run(callableRequest({ quizId: "q1" }, mfa)))).code).toBe(
      "failed-precondition"
    );
  });

  it("güvenli varsayılan: config/security yoksa veya değer bozuksa MFA zorunlu; yalnızca açık false kapatır", async () => {
    await createMember("u1", "user", "active");
    // E-postası doğrulanmış üye: bu test yalnızca MFA şartını sınar (doküman yokken ikisi de zorunlu).
    const member = { ...asMember("u1"), claims: { ...asMember("u1").claims, email_verified: true } };
    const attempt = () => errorOf(startQuizAttempt.run(callableRequest({ quizId: "q1" }, member)));
    await setSecurityConfig(null);
    expect((await attempt()).message).toContain("iki aşamalı");
    await setSecurityConfig({ requireMfa: "false" });
    expect((await attempt()).message).toContain("iki aşamalı");
    await setSecurityConfig({ requireMfa: false });
    expect((await attempt()).code).toBe("failed-precondition");
  });

  it("güvenli varsayılan (D21): config/security yoksa e-posta doğrulaması da zorunlu", async () => {
    await createMember("u1", "user", "active");
    await setSecurityConfig(null);
    const mfaOnly = {
      ...asMember("u1"),
      claims: { ...asMember("u1").claims, firebase: { sign_in_second_factor: "totp" } },
    };
    expect((await errorOf(startQuizAttempt.run(callableRequest({ quizId: "q1" }, mfaOnly)))).message).toContain(
      "e-posta"
    );
  });

  it("e-posta doğrulaması zorunluysa doğrulanmamış hesap reddedilir", async () => {
    await setSecurityConfig({ requireEmailVerified: true });
    await createMember("u1", "user", "active");
    expect((await errorOf(startQuizAttempt.run(callableRequest({ quizId: "q1" }, asMember("u1"))))).message).toContain(
      "e-posta"
    );
    const verified = { ...asMember("u1"), claims: { ...asMember("u1").claims, email_verified: true } };
    expect((await errorOf(startQuizAttempt.run(callableRequest({ quizId: "q1" }, verified)))).code).toBe(
      "failed-precondition"
    );
  });
});

describe("sıra: önce yetki, sonra doğrulama", () => {
  it("oturumsuz kullanıcı geçersiz veriyle de 'unauthenticated' alır (şema ayrıntısı sızmaz)", async () => {
    expect((await errorOf(startLectureSession.run(callableRequest({ title: 123 })))).code).toBe("unauthenticated");
  });

  it("yetkili kullanıcının geçersiz verisi Türkçe 'invalid-argument' döner", async () => {
    await createMember("admin", "admin", "active");
    const err = await errorOf(
      startLectureSession.run(callableRequest({ ...lecture, durationMinutes: 500 }, asAdmin()))
    );
    expect(err).toEqual({ code: "invalid-argument", message: "Yoklama süresi (dk) 1–240 arasında olmalıdır." });
    expect((await getFirestore().collection("attendance_sessions").get()).size).toBe(0);
  });
});
