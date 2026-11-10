import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import {
  completeRegistration,
  createInvitation,
  revokeInvitation,
  syncUserClaims,
  updateMemberAccess,
} from "../src/members";
import { CALLABLES } from "../src/shared/schemas";
import { KVKK_NOTICE_VERSION } from "../src/shared/consent";
import {
  asAdmin,
  asMember,
  auditActions,
  callableRequest,
  createMember,
  errorCode,
  errorOf,
  resetEmulators,
  type TestActor,
} from "./helpers";

const auth = () => getAuth();
const db = () => getFirestore();
const profile = async (uid: string) => (await db().doc(`users/${uid}`).get()).data();

/** Profili olmayan (yeni kayıt olmuş) kullanıcı. */
async function signedInOnly(uid: string, email = `${uid}@example.test`): Promise<TestActor> {
  await auth().createUser({ uid, email, password: "Test-Sifre-123" });
  return { uid, claims: { email } };
}

const registration = {
  title: "Asistan Dr.",
  fullName: "Yeni Asistan",
  residencyYear: 2,
  consentVersion: KVKK_NOTICE_VERSION,
};

async function invite(code: string, overrides: Record<string, unknown> = {}) {
  await db()
    .collection("invitations")
    .doc(code)
    .set({
      code,
      email: "davetli@example.test",
      intendedRole: "user",
      residencyYear: 3,
      invitedBy: "admin",
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
      used: false,
      revoked: false,
      ...overrides,
    });
}

beforeEach(async () => {
  await resetEmulators();
});

describe("updateMemberAccess", () => {
  beforeEach(async () => {
    await createMember("admin", "admin", "active");
  });

  it("oturumsuz çağrıyı ve aktif asistanın çağrısını reddeder", async () => {
    await createMember("asistan", "user", "active");
    await createMember("hedef", "user", "pending");
    expect(await errorCode(updateMemberAccess.run(callableRequest({ targetUid: "hedef", status: "active" })))).toBe(
      "unauthenticated"
    );
    expect(
      await errorCode(
        updateMemberAccess.run(callableRequest({ targetUid: "hedef", status: "active" }, asMember("asistan")))
      )
    ).toBe("permission-denied");
    expect((await profile("hedef"))?.status).toBe("pending");
  });

  it("onay: claim, profil ve denetim kaydı; oturum iptal edilmez", async () => {
    await createMember("hedef", "user", "pending");
    const res = await updateMemberAccess.run(callableRequest({ targetUid: "hedef", status: "active" }, asAdmin()));
    CALLABLES.updateMemberAccess.response.parse(res);
    expect(res).toMatchObject({ ok: true, targetUid: "hedef", status: "active", role: "user" });
    expect((await auth().getUser("hedef")).customClaims).toMatchObject({ role: "user", status: "active" });
    const p = await profile("hedef");
    expect(p).toMatchObject({ status: "active", approvedBy: "admin", updatedBy: "admin" });
    expect(p).not.toHaveProperty("tokensValidAfter");
    const log = (await db().collection("audit_logs").get()).docs
      .map((d) => d.data())
      .find((l) => l.action === "MEMBER_ACCESS_UPDATED");
    expect(log).toMatchObject({ actorUid: "admin", resourceId: "hedef", severity: "INFO" });
    expect(log?.timestamp).toBeInstanceOf(Timestamp);
  });

  it("askıya alma: tokensValidAfter yazılır ve yenileme token'ları iptal edilir", async () => {
    await createMember("hedef", "user", "active");
    const before = Math.floor(Date.now() / 1000);
    await updateMemberAccess.run(callableRequest({ targetUid: "hedef", status: "suspended" }, asAdmin()));
    const p = await profile("hedef");
    expect(p?.status).toBe("suspended");
    expect(p?.tokensValidAfter).toBeGreaterThanOrEqual(before);
    expect((await auth().getUser("hedef")).tokensValidAfterTime).toBeTruthy();
    expect(await auditActions()).toContain("MEMBER_ACCESS_UPDATED");
  });

  it("cihaz sıfırlama: cihaz bağı silinir ve oturum iptal edilir", async () => {
    await createMember("hedef", "user", "active", { boundDeviceHash: "f".repeat(64) });
    await updateMemberAccess.run(callableRequest({ targetUid: "hedef", resetBoundDevice: true }, asAdmin()));
    const p = await profile("hedef");
    expect(p).toMatchObject({ boundDeviceHash: null, status: "active" });
    expect(p?.tokensValidAfter).toBeGreaterThan(0);
    expect(await auditActions()).toContain("MEMBER_DEVICE_RESET");
  });

  it("admin kendi rolünü veya durumunu değiştiremez", async () => {
    await createMember("admin2", "admin", "active");
    const err = await errorOf(updateMemberAccess.run(callableRequest({ targetUid: "admin", role: "user" }, asAdmin())));
    expect(err.code).toBe("failed-precondition");
    expect(err.message).toContain("Kendi rolünüzü");
  });

  it("Auth'ta veya profilde olmayan kullanıcı için profil oluşturmaz", async () => {
    expect(
      await errorCode(updateMemberAccess.run(callableRequest({ targetUid: "hayalet", status: "active" }, asAdmin())))
    ).toBe("not-found");
    await auth().createUser({ uid: "profilsiz", email: "p@example.test" });
    expect(
      await errorCode(updateMemberAccess.run(callableRequest({ targetUid: "profilsiz", status: "active" }, asAdmin())))
    ).toBe("not-found");
    expect((await db().doc("users/profilsiz").get()).exists).toBe(false);
  });

  it("geçersiz kıdem yılını reddeder", async () => {
    await createMember("hedef", "user", "active");
    expect(
      await errorCode(updateMemberAccess.run(callableRequest({ targetUid: "hedef", residencyYear: 7 }, asAdmin())))
    ).toBe("invalid-argument");
  });
});

describe("son aktif admin koruması", () => {
  /**
   * Sıralı akışta bu koruma erişilemez: isteği yapan da aktif admin olmak zorunda (hedef "son" admin olamaz)
   * ve admin kendi rolünü/durumunu değiştiremez. Korumanın asıl işi YARIŞ durumudur: iki admin aynı anda
   * birbirini düşürürse ikisi de "2 aktif admin" görür ve sistem admin'siz kalır. Sayım transaction
   * içinde yapıldığı için yalnızca biri başarılı olmalıdır.
   */
  it("iki admin birbirini aynı anda düşürmeye çalışırsa yalnızca biri başarılı olur", async () => {
    await createMember("a1", "admin", "active");
    await createMember("a2", "admin", "active");

    const results = await Promise.allSettled([
      updateMemberAccess.run(callableRequest({ targetUid: "a2", role: "user" }, asAdmin("a1"))),
      updateMemberAccess.run(callableRequest({ targetUid: "a1", role: "user" }, asAdmin("a2"))),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toMatchObject({ code: "failed-precondition" });

    const admins = await db().collection("users").where("role", "==", "admin").where("status", "==", "active").get();
    expect(admins.size).toBe(1);
  });
});

describe("completeRegistration", () => {
  it("davetsiz kayıt: bekleyen profil, claim, denetim kaydı; rol/durum istemciden alınmaz", async () => {
    const me = await signedInOnly("yeni");
    const res = await completeRegistration.run(
      callableRequest({ ...registration, role: "admin", status: "active" }, me)
    );
    expect(CALLABLES.completeRegistration.response.parse(res)).toEqual({
      status: "pending",
      role: "user",
      alreadyRegistered: false,
    });
    expect(await profile("yeni")).toMatchObject({
      uid: "yeni",
      email: "yeni@example.test",
      title: "Asistan Dr.",
      fullName: "Yeni Asistan",
      residencyYear: 2,
      role: "user",
      status: "pending",
      inviteCode: null,
      boundDeviceHash: null,
      consent: { version: KVKK_NOTICE_VERSION },
    });
    expect((await profile("yeni"))?.consent?.acceptedAt).toBeTruthy();
    expect((await auth().getUser("yeni")).customClaims).toMatchObject({ role: "user", status: "pending" });
    expect(await auditActions()).toContain("MEMBER_REGISTERED");
  });

  it("KVKK onayı zorunlu ve yalnızca güncel sürüm kabul edilir (F3.5)", async () => {
    const me = await signedInOnly("onaysiz");
    const { consentVersion: _omit, ...withoutConsent } = registration;
    void _omit;
    expect(await errorCode(completeRegistration.run(callableRequest(withoutConsent, me)))).toBe("invalid-argument");
    const old = await errorOf(
      completeRegistration.run(callableRequest({ ...registration, consentVersion: "0.9" }, me))
    );
    expect(old).toEqual({ code: "invalid-argument", message: expect.stringContaining("aydınlatma metnini") });
    expect(await profile("onaysiz")).toBeUndefined();
  });

  it("kıdem yılı yalnızca asistan için: uzman hekimde null saklanır; asistanda zorunlu", async () => {
    const uzman = await signedInOnly("uzman");
    await completeRegistration.run(
      callableRequest({ title: "Uzm. Dr.", fullName: "Uzman Hekim", consentVersion: KVKK_NOTICE_VERSION }, uzman)
    );
    expect(await profile("uzman")).toMatchObject({ title: "Uzm. Dr.", residencyYear: null });
    expect((await auth().getUser("uzman")).customClaims).toMatchObject({ residencyYear: null });

    const asistan = await signedInOnly("yilsiz");
    const res = await errorOf(
      completeRegistration.run(
        callableRequest(
          { title: "Asistan Dr.", fullName: "Yılsız Asistan", consentVersion: KVKK_NOTICE_VERSION },
          asistan
        )
      )
    );
    expect(res).toEqual({ code: "invalid-argument", message: expect.stringContaining("Kıdem yılı") });
  });

  it("idempotent: ikinci çağrı hiçbir şeyi değiştirmez", async () => {
    const me = await signedInOnly("yeni");
    await completeRegistration.run(callableRequest(registration, me));
    const second = await completeRegistration.run(callableRequest({ ...registration, fullName: "Başka Ad" }, me));
    expect(second).toEqual({ status: "pending", role: "user", alreadyRegistered: true });
    expect((await profile("yeni"))?.fullName).toBe("Yeni Asistan");
  });

  it("geçerli davet: doğrudan aktif, rol ve kıdem davetten, davet tüketilir", async () => {
    await invite("PED-GECERLI1", { intendedRole: "admin" });
    const me = await signedInOnly("davetli", "Davetli@Example.test");
    const res = await completeRegistration.run(callableRequest({ ...registration, inviteCode: "ped-gecerli1" }, me));
    expect(res).toEqual({ status: "active", role: "admin", alreadyRegistered: false });
    expect(await profile("davetli")).toMatchObject({
      status: "active",
      role: "admin",
      residencyYear: 3,
      approvedBy: "admin",
    });
    expect((await db().doc("invitations/PED-GECERLI1").get()).data()).toMatchObject({ used: true, usedBy: "davetli" });
  });

  it.each([
    ["kullanılmış", { used: true }],
    ["iptal edilmiş", { revoked: true }],
    ["süresi dolmuş", { expiresAt: Timestamp.fromMillis(Date.now() - 1000) }],
    ["başka e-postaya ait", { email: "baskasi@example.test" }],
  ])("%s davet reddedilir ve profil oluşmaz", async (_name, overrides) => {
    await invite("PED-DAVET001", overrides);
    const me = await signedInOnly("davetli", "davetli@example.test");
    const err = await errorOf(
      completeRegistration.run(callableRequest({ ...registration, inviteCode: "PED-DAVET001" }, me))
    );
    expect(err.code).toBe("invalid-argument");
    expect((await db().doc("users/davetli").get()).exists).toBe(false);
  });

  it("olmayan davet kodu reddedilir; kodsuz tekrar denenince bekleyen olarak kaydolur", async () => {
    const me = await signedInOnly("yeni");
    expect(
      await errorCode(completeRegistration.run(callableRequest({ ...registration, inviteCode: "PED-YOKBOYLE" }, me)))
    ).toBe("invalid-argument");
    expect((await completeRegistration.run(callableRequest({ ...registration, inviteCode: "" }, me))).status).toBe(
      "pending"
    );
  });

  it("oturumsuz çağrı ve e-postasız hesap reddedilir", async () => {
    expect(await errorCode(completeRegistration.run(callableRequest(registration)))).toBe("unauthenticated");
    await auth().createUser({ uid: "epostasiz" });
    expect(
      await errorCode(
        completeRegistration.run(callableRequest(registration, { uid: "epostasiz", claims: { email: undefined } }))
      )
    ).toBe("failed-precondition");
  });
});

describe("davetler", () => {
  beforeEach(async () => {
    await createMember("admin", "admin", "active");
    await createMember("asistan", "user", "active");
  });

  it("admin davet oluşturur: kod biçimi, son kullanma, denetim kaydı; asistan oluşturamaz", async () => {
    const res = await createInvitation.run(
      callableRequest(
        { email: " Yeni@Example.TEST ", intendedRole: "user", residencyYear: 1, validForDays: 7 },
        asAdmin()
      )
    );
    CALLABLES.createInvitation.response.parse(res);
    expect(res.code).toMatch(/^PED-[A-HJ-NP-Z2-9]{8}$/);
    const doc = (await db().doc(`invitations/${res.invitationId}`).get()).data();
    expect(doc).toMatchObject({
      code: res.code,
      email: "yeni@example.test",
      used: false,
      revoked: false,
      invitedBy: "admin",
    });
    expect(res.expiresAtMs).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(await auditActions()).toContain("INVITATION_CREATED");

    expect(
      await errorCode(
        createInvitation.run(
          callableRequest({ email: "x@example.test", intendedRole: "admin", residencyYear: 1 }, asMember("asistan"))
        )
      )
    ).toBe("permission-denied");
  });

  it("kayıtlı üyenin e-postasına davet oluşturulamaz", async () => {
    expect(
      await errorCode(
        createInvitation.run(
          callableRequest({ email: "asistan@example.test", intendedRole: "user", residencyYear: 1 }, asAdmin())
        )
      )
    ).toBe("already-exists");
  });

  it("davet iptal edilir ve artık kullanılamaz; kullanılmış davet iptal edilemez", async () => {
    const { invitationId, code } = await createInvitation.run(
      callableRequest({ email: "aday@example.test", intendedRole: "user", residencyYear: 2 }, asAdmin())
    );
    CALLABLES.revokeInvitation.response.parse(await revokeInvitation.run(callableRequest({ invitationId }, asAdmin())));
    const me = await signedInOnly("aday");
    expect(await errorCode(completeRegistration.run(callableRequest({ ...registration, inviteCode: code }, me)))).toBe(
      "invalid-argument"
    );

    await invite("PED-KULLANILDI", { used: true });
    expect(await errorCode(revokeInvitation.run(callableRequest({ invitationId: "PED-KULLANILDI" }, asAdmin())))).toBe(
      "failed-precondition"
    );
  });
});

describe("syncUserClaims", () => {
  const event = (
    uid: string,
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown> | undefined
  ) => ({
    params: { uid },
    data: {
      before: { exists: !!before, data: () => before },
      after: { exists: !!after, data: () => after, ref: db().doc(`users/${uid}`) },
    },
  });
  const run = (e: ReturnType<typeof event>) =>
    syncUserClaims.run(e as unknown as Parameters<typeof syncUserClaims.run>[0]);

  it("yeni profil için claim'leri yazar; geçersiz rolü 'user'a indirger", async () => {
    await auth().createUser({ uid: "u1", email: "u1@example.test" });
    await run(event("u1", undefined, { role: "superadmin", status: "active", residencyYear: 2 }));
    expect((await auth().getUser("u1")).customClaims).toEqual({ role: "user", status: "active", residencyYear: 2 });
    expect(await auditActions()).toContain("MEMBER_CLAIMS_INITIALIZED");
  });

  it("konsoldan askıya alma: oturumlar iptal edilir ve tokensValidAfter yazılır", async () => {
    await createMember("u1", "user", "active");
    const before = { role: "user", status: "active", residencyYear: 1 };
    const after = { role: "user", status: "suspended", residencyYear: 1 };
    await db().doc("users/u1").set(after, { merge: true });
    await run(event("u1", before, after));
    expect((await profile("u1"))?.tokensValidAfter).toBeGreaterThan(0);
    expect((await auth().getUser("u1")).customClaims).toMatchObject({ status: "suspended" });
  });

  it("yalnızca başka alanlar değiştiyse hiçbir şey yapmaz (döngü yok)", async () => {
    await createMember("u1", "user", "active");
    const base = { role: "user", status: "active", residencyYear: 1 };
    await run(event("u1", base, { ...base, tokensValidAfter: 123 }));
    expect(await auditActions()).not.toContain("MEMBER_CLAIMS_SYNCED");
  });
});
