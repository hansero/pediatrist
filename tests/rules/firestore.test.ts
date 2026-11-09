import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { claimsOf, createRulesEnv, member, seedMembers } from "./helpers";

/**
 * Firestore güvenlik kuralları.
 *
 * `it.fails`: AUDIT.md'deki BİLİNEN açıkları belgeler. Açık var oldukça bu testler "geçer";
 * açık kapatılınca kırmızıya döner ve `it` olarak değiştirilmelidir (bkz. ilgili plan adımı).
 */
const admin = member("t-admin", "admin", "active");
const resident = member("t-res", "user", "active");
const other = member("t-other", "user", "active");
const pending = member("t-pending", "user", "pending");

let env: RulesTestEnvironment;
const as = (m: ReturnType<typeof member>) => env.authenticatedContext(m.uid, claimsOf(m)).firestore();

beforeAll(async () => {
  env = await createRulesEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seedMembers(env, [admin, resident, other, pending]);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("materials").doc("m1").set({ title: "Materyal", status: "published" });
    await db.collection("attendance_logs").doc(`s1_${resident.uid}`).set({ uid: resident.uid, sessionId: "s1" });
    await db.collection("attendance_logs").doc(`s1_${other.uid}`).set({ uid: other.uid, sessionId: "s1" });
    await db
      .collection("quiz_answer_keys")
      .doc("q1")
      .collection("items")
      .doc("q_001")
      .set({ correctAnswers: ["A"] });
    await db.collection("quizzes").doc("q1").set({ title: "Sınav", status: "published" });
    await db.collection("quizzes").doc("q1").collection("questions_public").doc("q_001").set({ questionText: "?" });
    await db.collection("invitations").doc("i1").set({ code: "DAVET", email: "x@example.test", used: false });
    await db.collection("quiz_attempts").doc(`q1_${other.uid}`).set({ uid: other.uid, quizId: "q1", score: 80 });
  });
});

describe("kimlik ve üyelik durumu", () => {
  it("oturum açmamış kullanıcı materyal okuyamaz", async () => {
    await assertFails(env.unauthenticatedContext().firestore().collection("materials").doc("m1").get());
  });

  it("onay bekleyen kullanıcı materyal okuyamaz", async () => {
    await assertFails(as(pending).collection("materials").doc("m1").get());
  });

  it("aktif üye materyal okuyabilir", async () => {
    await assertSucceeds(as(resident).collection("materials").doc("m1").get());
  });

  it("kullanıcı kendi profilinde rol veya durum değiştiremez", async () => {
    await assertFails(as(resident).collection("users").doc(resident.uid).update({ role: "admin" }));
    await assertFails(as(pending).collection("users").doc(pending.uid).update({ status: "active" }));
  });

  it("istemci kendini admin olarak kaydedemez", async () => {
    const db = env.authenticatedContext("t-new", {}).firestore();
    await assertFails(db.collection("users").doc("t-new").set({ uid: "t-new", role: "admin", status: "active" }));
  });

  it.fails("C5 (F2.1): askıya alınmış üye, eski 'active' claim'li token'la materyal okuyamaz", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("users").doc(resident.uid).update({ status: "suspended" });
    });
    // Token hâlâ askıya almadan önceki claim'leri taşıyor (ID token 1 saat geçerli).
    await assertFails(as(resident).collection("materials").doc("m1").get());
  });
});

describe("kişisel veri izolasyonu", () => {
  it("asistan yalnızca kendi yoklama logunu okur", async () => {
    await assertSucceeds(as(resident).collection("attendance_logs").doc(`s1_${resident.uid}`).get());
    await assertFails(as(resident).collection("attendance_logs").doc(`s1_${other.uid}`).get());
  });

  it("asistan filtresiz yoklama logu listeleyemez, kendi uid filtresiyle listeleyebilir", async () => {
    await assertFails(as(resident).collection("attendance_logs").get());
    await assertSucceeds(as(resident).collection("attendance_logs").where("uid", "==", resident.uid).get());
  });

  it("asistan başkasının sınav girişimini okuyamaz", async () => {
    await assertFails(as(resident).collection("quiz_attempts").doc(`q1_${other.uid}`).get());
  });

  it("admin bütün yoklama loglarını listeleyebilir", async () => {
    await assertSucceeds(as(admin).collection("attendance_logs").get());
  });
});

describe("sınav gizliliği", () => {
  it("asistan cevap anahtarını okuyamaz", async () => {
    await assertFails(as(resident).collection("quiz_answer_keys").doc("q1").collection("items").doc("q_001").get());
  });

  it.fails("C7 (F2.1/F5.1): asistan sınava başlamadan yayındaki soruları okuyamaz", async () => {
    await assertFails(as(resident).collection("quizzes").doc("q1").collection("questions_public").doc("q_001").get());
  });
});

describe("değiştirilemez kayıtlar ve davetler", () => {
  it("hiçbir istemci (admin dahil) denetim kaydı yazamaz", async () => {
    await assertFails(as(admin).collection("audit_logs").add({ action: "FAKE" }));
    await assertFails(as(resident).collection("audit_logs").add({ action: "FAKE" }));
  });

  it("asistan yoklama oturumu oluşturamaz", async () => {
    await assertFails(as(resident).collection("attendance_sessions").doc("x").set({ status: "live" }));
  });

  it.fails("C9 (F2.1): asistan davet kodlarını okuyamaz", async () => {
    await assertFails(as(resident).collection("invitations").doc("i1").get());
  });
});
