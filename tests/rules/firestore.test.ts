import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import firebase from "firebase/compat/app";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  claimsOf,
  createRulesEnv,
  EMAIL_VERIFIED,
  member,
  seedMembers,
  seedSecurityConfig,
  SECOND_FACTOR,
} from "./helpers";

/**
 * Firestore güvenlik kuralları (F2.1). Yetkinin kaynağı `users/{uid}` dokümanıdır (D3);
 * testlerde token claim'leri bilerek dokümanla ÇELİŞTİRİLİR ki kuralların claim'e değil
 * dokümana baktığı kanıtlansın.
 */
const admin = member("t-admin", "admin", "active");
const resident = member("t-res", "user", "active");
const other = member("t-other", "user", "active");
const pending = member("t-pending", "user", "pending");

let env: RulesTestEnvironment;
const ctx = (m: ReturnType<typeof member>, extraClaims: Record<string, unknown> = {}) =>
  env.authenticatedContext(m.uid, { ...claimsOf(m), ...extraClaims });
const as = (m: ReturnType<typeof member>, extraClaims: Record<string, unknown> = {}) => ctx(m, extraClaims).firestore();
const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();

beforeAll(async () => {
  env = await createRulesEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seedMembers(env, [admin, resident, other, pending]);
  await seedSecurityConfig(env, { requireMfa: false });
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await db.collection("materials").doc("m1").set({ title: "Materyal", status: "published" });
    await db.collection("materials").doc("draft1").set({ title: "Taslak", status: "draft" });
    await db.collection("materials").doc("m1").collection("progress").doc(other.uid).set({ uid: other.uid });
    await db.collection("attendance_logs").doc(`s1_${resident.uid}`).set({ uid: resident.uid, sessionId: "s1" });
    await db.collection("attendance_logs").doc(`s1_${other.uid}`).set({ uid: other.uid, sessionId: "s1" });
    await db.collection("attendance_sessions").doc("live1").set({ status: "live", title: "Canlı" });
    await db.collection("attendance_sessions").doc("old1").set({ status: "closed", title: "Geçmiş" });
    await db
      .collection("attendance_sessions")
      .doc("old1")
      .collection("records")
      .doc(resident.uid)
      .set({ uid: resident.uid });
    await db.collection("attendance_sessions").doc("old1").collection("records").doc(other.uid).set({ uid: other.uid });
    await db
      .collection("quiz_answer_keys")
      .doc("q1")
      .collection("items")
      .doc("q_001")
      .set({ correctAnswers: ["A"] });
    await db.collection("quizzes").doc("q1").set({ title: "Sınav", status: "published" });
    await db.collection("quizzes").doc("q1").collection("questions_public").doc("q_001").set({ questionText: "?" });
    await db.collection("quizzes").doc("draft1").set({ title: "Taslak", status: "draft" });
    await db.collection("invitations").doc("i1").set({ code: "DAVET", email: "x@example.test", used: false });
    await db.collection("quiz_attempts").doc(`q1_${other.uid}`).set({ uid: other.uid, quizId: "q1", score: 80 });
    await db.collection("audit_logs").doc("a1").set({ action: "X" });
    await db.collection("clinic_members").doc(resident.uid).set({ status: "active" });
  });
});

describe("kimlik ve üyelik durumu (doküman yetkinin kaynağıdır)", () => {
  it("oturum açmamış kullanıcı materyal okuyamaz", async () => {
    await assertFails(env.unauthenticatedContext().firestore().collection("materials").doc("m1").get());
  });

  it("onay bekleyen kullanıcı, token'ında 'active' claim olsa da materyal okuyamaz", async () => {
    await assertFails(as(pending, { status: "active" }).collection("materials").doc("m1").get());
  });

  it("aktif üye materyal okuyabilir", async () => {
    await assertSucceeds(as(resident).collection("materials").doc("m1").get());
  });

  it("C5: askıya alınmış üye, eski 'active' claim'li token'la materyal okuyamaz", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await c.firestore().collection("users").doc(resident.uid).update({ status: "suspended" });
    });
    await assertFails(as(resident).collection("materials").doc("m1").get());
  });

  it("claim'de admin yazsa da dokümanda 'user' olan kullanıcı admin verisini okuyamaz", async () => {
    await assertFails(as(resident, { role: "admin" }).collection("audit_logs").doc("a1").get());
  });

  it("profili olmayan oturum hiçbir modül verisini okuyamaz", async () => {
    await assertFails(
      env.authenticatedContext("hayalet", { status: "active" }).firestore().collection("materials").doc("m1").get()
    );
  });

  it("tokensValidAfter'dan önce açılmış oturum reddedilir, sonrası kabul edilir", async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedMembers(env, [resident], { tokensValidAfter: now });
    await assertFails(
      as(resident, { auth_time: now - 60 })
        .collection("materials")
        .doc("m1")
        .get()
    );
    await assertSucceeds(
      as(resident, { auth_time: now + 5 })
        .collection("materials")
        .doc("m1")
        .get()
    );
  });

  it("kendi profilini durumu ne olursa olsun okur; başkasınınkini okuyamaz", async () => {
    await assertSucceeds(as(pending).collection("users").doc(pending.uid).get());
    await assertFails(as(resident).collection("users").doc(other.uid).get());
    await assertSucceeds(as(admin).collection("users").doc(other.uid).get());
  });

  it("hiç kimse (admin dahil) profil güncelleyemez; yetki değişikliği yalnızca Cloud Functions ile", async () => {
    await assertFails(as(resident).collection("users").doc(resident.uid).update({ role: "admin" }));
    await assertFails(as(pending).collection("users").doc(pending.uid).update({ status: "active" }));
    await assertFails(as(admin).collection("users").doc(other.uid).update({ status: "suspended" }));
    await assertFails(as(admin).collection("users").doc(other.uid).delete());
  });

  it("kaldırılan 'clinic_members' koleksiyonu kapalıdır", async () => {
    await assertFails(as(resident).collection("clinic_members").doc(resident.uid).get());
  });
});

describe("profil oluşturma (F2.3: yalnızca sunucu, completeRegistration)", () => {
  const uid = "t-new";
  const email = "yeni@example.test";
  const db = () => env.authenticatedContext(uid, { email }).firestore();
  // F2.1'deki geçici kuralın izin verdiği (eski kayıt ekranının yazdığı) biçim:
  const legacyRegistrationDoc = () => ({
    uid,
    title: "Asistan Dr.",
    fullName: "Yeni Asistan",
    email,
    residencyYear: 1,
    role: "user",
    status: "pending",
    inviteCode: null,
    mfaEnabled: false,
    boundDeviceHash: null,
    createdAt: serverTime(),
  });

  it("istemci, eski kayıt ekranının geçerli biçimiyle bile profil oluşturamaz (D4)", async () => {
    await assertFails(db().collection("users").doc(uid).set(legacyRegistrationDoc()));
  });

  it("kendini admin/aktif kaydetme girişimleri de reddedilir", async () => {
    await assertFails(
      db()
        .collection("users")
        .doc(uid)
        .set({ ...legacyRegistrationDoc(), role: "admin" })
    );
    await assertFails(
      db()
        .collection("users")
        .doc(uid)
        .set({ ...legacyRegistrationDoc(), status: "active" })
    );
  });
});

describe("kişisel veri izolasyonu", () => {
  it("asistan yalnızca kendi yoklama logunu okur; filtresiz liste reddedilir", async () => {
    await assertSucceeds(as(resident).collection("attendance_logs").doc(`s1_${resident.uid}`).get());
    await assertFails(as(resident).collection("attendance_logs").doc(`s1_${other.uid}`).get());
    await assertFails(as(resident).collection("attendance_logs").get());
    await assertSucceeds(as(resident).collection("attendance_logs").where("uid", "==", resident.uid).get());
  });

  it("asistan yalnızca canlı dersi görür; geçmiş ders ve başkasının kaydı admin'e özel", async () => {
    await assertSucceeds(as(resident).collection("attendance_sessions").doc("live1").get());
    await assertFails(as(resident).collection("attendance_sessions").doc("old1").get());
    await assertSucceeds(as(resident).doc(`attendance_sessions/old1/records/${resident.uid}`).get());
    await assertFails(as(resident).doc(`attendance_sessions/old1/records/${other.uid}`).get());
    await assertSucceeds(as(admin).collection("attendance_sessions").doc("old1").get());
    await assertSucceeds(as(admin).collection("attendance_logs").get());
  });

  it("yoklama raporu sorguları (F4.5): admin tarih aralığıyla okur, asistan okuyamaz", async () => {
    const since = new Date(Date.now() - 90 * 86_400_000);
    const logsInRange = (c: ReturnType<typeof as>) =>
      c.collection("attendance_logs").where("sessionStartedAt", ">=", since).orderBy("sessionStartedAt", "desc").get();
    const closedInRange = (c: ReturnType<typeof as>) =>
      c
        .collection("attendance_sessions")
        .where("status", "==", "closed")
        .where("startedAt", ">=", since)
        .orderBy("startedAt", "desc")
        .get();
    await assertSucceeds(logsInRange(as(admin)));
    await assertSucceeds(closedInRange(as(admin)));
    await assertSucceeds(as(admin).collection("attendance_sessions").doc("old1").collection("records").get());
    await assertFails(logsInRange(as(resident)));
    await assertFails(closedInRange(as(resident)));
    await assertFails(as(resident).collection("attendance_sessions").doc("old1").collection("records").get());
  });

  it("asistan başkasının sınav girişimini okuyamaz", async () => {
    await assertFails(as(resident).collection("quiz_attempts").doc(`q1_${other.uid}`).get());
  });
});

describe("sınav gizliliği", () => {
  it("asistan cevap anahtarını ve arşivi okuyamaz", async () => {
    await assertFails(as(resident).collection("quiz_answer_keys").doc("q1").collection("items").doc("q_001").get());
    await assertFails(as(resident).collection("quiz_question_archive").get());
  });

  it("C7: asistan yayındaki sınavın sorularını doğrudan okuyamaz (sorular startQuizAttempt ile gelir)", async () => {
    await assertFails(as(resident).collection("quizzes").doc("q1").collection("questions_public").doc("q_001").get());
    await assertSucceeds(as(admin).collection("quizzes").doc("q1").collection("questions_public").doc("q_001").get());
  });

  it("F5.1: süre içinde kaydedilen yanıtlar (quiz_attempt_drafts) istemciye tamamen kapalı (sahibi ve admin dahil)", async () => {
    const id = `q1_${resident.uid}`;
    await assertFails(as(resident).collection("quiz_attempt_drafts").doc(id).get());
    await assertFails(as(resident).collection("quiz_attempt_drafts").doc(id).set({ uid: resident.uid, responses: {} }));
    await assertFails(as(admin).collection("quiz_attempt_drafts").doc(id).get());
  });

  it("asistan yayındaki sınavı görür, taslağı göremez; yalnızca durum filtreli liste", async () => {
    await assertSucceeds(as(resident).collection("quizzes").doc("q1").get());
    await assertFails(as(resident).collection("quizzes").doc("draft1").get());
    await assertSucceeds(as(resident).collection("quizzes").where("status", "==", "published").get());
    await assertFails(as(resident).collection("quizzes").get());
  });
});

describe("materyal okuma ilerlemesi", () => {
  const progress = (uid: string, overrides: Record<string, unknown> = {}) => ({
    uid,
    secondsSpent: 120,
    lastPage: 2,
    completed: false,
    updatedAt: serverTime(),
    ...overrides,
  });
  const ref = (m: ReturnType<typeof member>, uid = m.uid) => as(m).doc(`materials/m1/progress/${uid}`);

  it("aktif üye kendi ilerlemesini tanımlı alanlarla yazar ve okur", async () => {
    await assertSucceeds(ref(resident).set(progress(resident.uid)));
    await assertSucceeds(ref(resident).get());
  });

  it("ek alan, yanlış tip, negatif süre veya istemci zamanı reddedilir", async () => {
    await assertFails(ref(resident).set(progress(resident.uid, { score: 100 })));
    await assertFails(ref(resident).set(progress(resident.uid, { completed: "evet" })));
    await assertFails(ref(resident).set(progress(resident.uid, { secondsSpent: -1 })));
    await assertFails(
      ref(resident).set(progress(resident.uid, { updatedAt: firebase.firestore.Timestamp.fromMillis(0) }))
    );
  });

  it("başkası adına yazamaz, başkasınınkini okuyamaz; bekleyen kullanıcı yazamaz", async () => {
    await assertFails(ref(resident, other.uid).set(progress(other.uid)));
    await assertFails(ref(resident, other.uid).get());
    await assertFails(ref(pending).set(progress(pending.uid)));
  });

  it("F6.1: taslak materyale ilerleme yazılamaz; taslak dokümanı hekime görünmez, admin görür", async () => {
    await assertFails(as(resident).doc(`materials/draft1/progress/${resident.uid}`).set(progress(resident.uid)));
    await assertFails(as(resident).doc(`materials/olmayan/progress/${resident.uid}`).set(progress(resident.uid)));
    await assertFails(as(resident).collection("materials").doc("draft1").get());
    await assertSucceeds(as(admin).collection("materials").doc("draft1").get());
    await assertFails(as(resident).collection("materials").get());
    await assertSucceeds(as(resident).collection("materials").where("status", "==", "published").get());
  });

  it("admin bütün materyallerin ilerlemesini tek sorguda (collectionGroup) okur; asistan okuyamaz", async () => {
    await assertSucceeds(as(admin).collectionGroup("progress").get());
    await assertFails(as(resident).collectionGroup("progress").get());
  });
});

describe("değiştirilemez kayıtlar, davetler, yapılandırma", () => {
  it("hiçbir istemci (admin dahil) denetim kaydı yazamaz; yalnızca admin okur", async () => {
    await assertFails(as(admin).collection("audit_logs").add({ action: "FAKE" }));
    await assertFails(as(resident).collection("audit_logs").add({ action: "FAKE" }));
    await assertSucceeds(as(admin).collection("audit_logs").doc("a1").get());
    await assertFails(as(resident).collection("audit_logs").doc("a1").get());
  });

  it("istemci yoklama oturumu, sınav veya materyal yazamaz (admin dahil)", async () => {
    await assertFails(as(resident).collection("attendance_sessions").doc("x").set({ status: "live" }));
    await assertFails(as(admin).collection("attendance_sessions").doc("x").set({ status: "live" }));
    await assertFails(as(admin).collection("quizzes").doc("x").set({ status: "published" }));
    await assertFails(as(admin).collection("materials").doc("x").set({ title: "x" }));
  });

  it("C9: asistan davet kodlarını okuyamaz; admin okur", async () => {
    await assertFails(as(resident).collection("invitations").doc("i1").get());
    await assertSucceeds(as(admin).collection("invitations").doc("i1").get());
  });

  it("aktif üye hesaplayıcı notlarını okur, admin bile doğrudan yazamaz (F7.4: callable)", async () => {
    await assertSucceeds(as(resident).collection("calculators_config").doc("c1").get());
    await assertFails(as(admin).collection("calculators_config").doc("c1").set({ clinicalProtocolNote: "x" }));
  });

  it("tanımlanmamış koleksiyonlar varsayılan olarak kapalıdır", async () => {
    await assertFails(as(admin).collection("baska_bir_sey").doc("x").get());
  });

  it("yoklama kilidi (attendance_meta) ve HMAC sırları admin dahil istemciye kapalıdır (F4.1)", async () => {
    await assertFails(as(admin, SECOND_FACTOR).collection("attendance_meta").doc("live").get());
    await assertFails(as(admin, SECOND_FACTOR).collection("attendance_meta").doc("live").set({ sessionId: "x" }));
    await assertFails(as(admin, SECOND_FACTOR).collection("attendance_secrets").doc("s1").get());
  });

  it("WebAuthn challenge'ları kendi sahibine dahil istemciye kapalıdır (F4.2)", async () => {
    await assertFails(
      as(resident, SECOND_FACTOR).collection("webauthn_challenges").doc(`${resident.uid}_attendance`).get()
    );
    await assertFails(
      as(resident, SECOND_FACTOR)
        .collection("webauthn_challenges")
        .doc(`${resident.uid}_attendance`)
        .set({ challenge: "x" })
    );
  });
});

describe("MFA zorunluluğu (N8: config/security tek kaynak)", () => {
  const materials = (db: ReturnType<typeof as>) => db.collection("materials").doc("m1").get();

  it("zorunluyken ikinci faktörsüz oturum veri okuyamaz; TOTP ile açılmış oturum okur", async () => {
    await seedSecurityConfig(env, { requireMfa: true });
    await assertFails(materials(as(resident)));
    await assertSucceeds(materials(as(resident, SECOND_FACTOR)));
  });

  it("şifresi çalınmış admin hesabı MFA'sız üye listesini, denetim kayıtlarını ve davetleri okuyamaz", async () => {
    await seedSecurityConfig(env, { requireMfa: true });
    await assertFails(as(admin).collection("users").doc(resident.uid).get());
    await assertFails(as(admin).collection("audit_logs").get());
    await assertFails(as(admin).collection("invitations").get());
    await assertFails(as(admin).collection("quiz_answer_keys").doc("q1").get());
    await assertSucceeds(as(admin, SECOND_FACTOR).collection("audit_logs").get());
  });

  it("kendi profilini okuma MFA istemez (oturum bağlamı ve MFA kurulum sayfası için)", async () => {
    await seedSecurityConfig(env, { requireMfa: true });
    await assertSucceeds(as(resident).collection("users").doc(resident.uid).get());
  });

  it("güvenli varsayılan: doküman yoksa veya değer bozuksa zorunlu; yalnızca boolean false kapatır", async () => {
    await seedSecurityConfig(env, null);
    await assertFails(materials(as(resident)));
    await seedSecurityConfig(env, { requireMfa: "false" });
    await assertFails(materials(as(resident)));
    await seedSecurityConfig(env, { requireMfa: false });
    await assertSucceeds(materials(as(resident)));
  });

  it("config/security: oturum açmış herkes okur, kimse yazamaz", async () => {
    await assertSucceeds(as(pending).collection("config").doc("security").get());
    await assertFails(env.unauthenticatedContext().firestore().collection("config").doc("security").get());
    await assertFails(as(admin, SECOND_FACTOR).collection("config").doc("security").set({ requireMfa: false }));
    await assertFails(as(admin, SECOND_FACTOR).collection("config").doc("other").get());
  });

  it("MFA'sız oturum kendi okuma ilerlemesini de yazamaz", async () => {
    await seedSecurityConfig(env, { requireMfa: true });
    const progress = (db: ReturnType<typeof as>) =>
      db
        .collection("materials")
        .doc("m1")
        .collection("progress")
        .doc(resident.uid)
        .set({ uid: resident.uid, secondsSpent: 1, lastPage: 1, completed: false, updatedAt: serverTime() });
    await assertFails(progress(as(resident)));
    await assertSucceeds(progress(as(resident, SECOND_FACTOR)));
  });
});

describe("e-posta doğrulama zorunluluğu (D21: config/security tek kaynak)", () => {
  const materials = (db: ReturnType<typeof as>) => db.collection("materials").doc("m1").get();

  it("zorunluyken doğrulanmamış e-postalı oturum veri okuyamaz; doğrulanmış okur", async () => {
    await seedSecurityConfig(env, { requireEmailVerified: true });
    await assertFails(materials(as(resident)));
    await assertSucceeds(materials(as(resident, EMAIL_VERIFIED)));
  });

  it("kendi profilini okuma e-posta doğrulaması istemez (doğrulama ekranı için)", async () => {
    await seedSecurityConfig(env, { requireEmailVerified: true });
    await assertSucceeds(as(resident).collection("users").doc(resident.uid).get());
  });

  it("doküman yoksa MFA ve e-posta birlikte zorunlu; ikisini de sağlayan okur", async () => {
    await seedSecurityConfig(env, null);
    await assertFails(materials(as(resident, SECOND_FACTOR)));
    await assertFails(materials(as(resident, EMAIL_VERIFIED)));
    await assertSucceeds(materials(as(resident, { ...SECOND_FACTOR, ...EMAIL_VERIFIED })));
  });
});
