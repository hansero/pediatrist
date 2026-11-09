import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { onClinicMemberCreated, updateMemberAccess } from "../src/authTriggers";
import { callableRequest, errorCode, resetEmulators } from "./helpers";

const auth = () => getAuth();
const db = () => getFirestore();

async function createMember(uid: string, role: "admin" | "user", status: "active" | "pending" | "suspended") {
  await auth().createUser({ uid, email: `${uid}@example.test`, password: "Test-Sifre-123" });
  await auth().setCustomUserClaims(uid, { role, status, residencyYear: 1 });
  await db()
    .collection("users")
    .doc(uid)
    .set({ uid, role, status, residencyYear: 1, email: `${uid}@example.test` });
}

async function auditActions() {
  const snap = await db().collection("audit_logs").get();
  return snap.docs.map((d) => d.data());
}

beforeEach(async () => {
  await resetEmulators();
});

describe("updateMemberAccess", () => {
  it("oturumsuz çağrıyı reddeder", async () => {
    expect(await errorCode(updateMemberAccess.run(callableRequest({ targetUid: "x", status: "active" })))).toBe(
      "unauthenticated"
    );
  });

  it("aktif asistanın çağrısını reddeder", async () => {
    await createMember("asistan", "user", "active");
    await createMember("hedef", "user", "pending");
    const req = callableRequest(
      { targetUid: "hedef", status: "active" as const },
      { uid: "asistan", claims: { role: "user", status: "active" } }
    );
    expect(await errorCode(updateMemberAccess.run(req))).toBe("permission-denied");
    expect((await db().collection("users").doc("hedef").get()).data()?.status).toBe("pending");
  });

  it("admin onayı claim'leri, profili ve sunucu zaman damgalı denetim kaydını günceller", async () => {
    await createMember("admin", "admin", "active");
    await createMember("hedef", "user", "pending");
    const req = callableRequest(
      { targetUid: "hedef", status: "active" as const },
      { uid: "admin", claims: { role: "admin", status: "active", email: "admin@example.test" } }
    );

    const res = await updateMemberAccess.run(req);

    expect(res).toMatchObject({ ok: true, targetUid: "hedef", status: "active", role: "user" });
    expect((await auth().getUser("hedef")).customClaims).toMatchObject({ role: "user", status: "active" });
    const profile = (await db().collection("users").doc("hedef").get()).data();
    expect(profile).toMatchObject({ status: "active", approvedBy: "admin" });
    const logs = await auditActions();
    const log = logs.find((l) => l.action === "MEMBER_ACCESS_UPDATED");
    expect(log).toMatchObject({ actorUid: "admin", resourceId: "hedef", severity: "INFO" });
    // FieldValue.serverTimestamp() gerçek bir Timestamp olarak yazılmış olmalı.
    expect(log?.timestamp).toBeInstanceOf(Timestamp);
  });
});

describe("onClinicMemberCreated (users/{uid} yazımı → claim senkronu)", () => {
  it("yeni profil için 'pending' claim'leri ayarlar ve denetim kaydı yazar", async () => {
    await auth().createUser({ uid: "yeni", email: "yeni@example.test" });
    const after = { uid: "yeni", role: "user", status: "pending", residencyYear: 2, email: "yeni@example.test" };
    const event = {
      params: { uid: "yeni" },
      data: { before: { exists: false, data: () => undefined }, after: { exists: true, data: () => after } },
    };

    await onClinicMemberCreated.run(event as unknown as Parameters<typeof onClinicMemberCreated.run>[0]);

    expect((await auth().getUser("yeni")).customClaims).toEqual({ role: "user", status: "pending", residencyYear: 2 });
    const logs = await auditActions();
    expect(logs.map((l) => l.action)).toContain("NEW_MEMBER_REGISTERED_WITH_PENDING_STATUS");
  });

  it("dokümandaki geçersiz rol değerini 'user' claim'ine indirger", async () => {
    await auth().createUser({ uid: "sahte", email: "sahte@example.test" });
    const after = { uid: "sahte", role: "superadmin", status: "active", residencyYear: 1 };
    const event = {
      params: { uid: "sahte" },
      data: { before: { exists: false, data: () => undefined }, after: { exists: true, data: () => after } },
    };

    await onClinicMemberCreated.run(event as unknown as Parameters<typeof onClinicMemberCreated.run>[0]);

    expect((await auth().getUser("sahte")).customClaims).toMatchObject({ role: "user" });
  });
});
