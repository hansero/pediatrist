import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { CALLABLES } from "../src/shared/schemas";
import { beginDeviceRegistration, finishDeviceRegistration } from "../src/webauthn";
import { asMember, auditActions, callableRequest, createMember, errorOf, resetEmulators } from "./helpers";
import { SoftAuthenticator } from "./softAuthenticator";

/** F4.2: yoklama cihazı (passkey) kaydı. Yanıtlar yazılım doğrulayıcıyla gerçek kriptografiyle üretilir. */
const db = () => getFirestore();
const begin = async (uid = "r1") => {
  const res = await beginDeviceRegistration.run(callableRequest({}, asMember(uid)));
  return CALLABLES.beginDeviceRegistration.response.parse(res).options;
};
const finish = (response: unknown, uid = "r1") =>
  finishDeviceRegistration.run(callableRequest({ response }, asMember(uid)));

beforeEach(async () => {
  await resetEmulators();
  await createMember("r1", "user", "active");
});

describe("yoklama cihazı kaydı", () => {
  it("platform passkey'i, kullanıcı doğrulaması zorunlu, RP = localhost; credential hesaba bağlanır", async () => {
    const options = await begin();
    expect(options).toMatchObject({
      rp: { id: "localhost", name: "Pediatrist" },
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      attestation: "none",
    });
    const auth = new SoftAuthenticator();
    const res = await finish(auth.register(options));
    expect(CALLABLES.finishDeviceRegistration.response.parse(res)).toEqual({ registered: true, backedUp: false });

    const webauthn = (await db().doc("users/r1").get()).data()?.webauthn;
    expect(webauthn).toMatchObject({
      credentialId: auth.credentialId.toString("base64url"),
      counter: 0,
      transports: ["internal"],
      backedUp: false,
    });
    expect(webauthn.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await auditActions()).toContain("ATTENDANCE_DEVICE_REGISTERED");
    expect((await db().doc("webauthn_challenges/r1_register").get()).exists).toBe(false);
  });

  it("hesap başına tek cihaz: kayıtlıyken yeni kayıt başlatılamaz", async () => {
    await finish(new SoftAuthenticator().register(await begin()));
    const err = await errorOf(beginDeviceRegistration.run(callableRequest({}, asMember("r1"))));
    expect(err).toEqual({ code: "failed-precondition", message: expect.stringContaining("zaten bir yoklama cihazı") });
  });

  it("challenge tek kullanımlıktır: geçersiz bir deneme challenge'ı tüketir, ardından geçerli yanıt da kabul edilmez", async () => {
    const options = await begin();
    const auth = new SoftAuthenticator();
    const bad = await errorOf(finish(auth.register(options, { origin: "https://pediatrist.evil" })));
    expect(bad.code).toBe("permission-denied");
    expect(await auditActions()).toContain("ATTENDANCE_DEVICE_REGISTRATION_REJECTED");
    expect((await errorOf(finish(auth.register(options)))).code).toBe("deadline-exceeded");
    expect((await db().doc("users/r1").get()).data()?.webauthn).toBeUndefined();
  });

  it("kullanıcı doğrulaması (biyometrik/PIN) olmadan kayıt reddedilir", async () => {
    const options = await begin();
    expect(
      (await errorOf(finish(new SoftAuthenticator().register(options, { withoutUserVerification: true })))).code
    ).toBe("permission-denied");
  });

  it("süresi dolmuş challenge ile kayıt reddedilir", async () => {
    const options = await begin();
    await db()
      .doc("webauthn_challenges/r1_register")
      .update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    expect((await errorOf(finish(new SoftAuthenticator().register(options)))).code).toBe("deadline-exceeded");
  });

  it("RP ayarı yoksa cihaz işlemleri güvenli biçimde reddedilir", async () => {
    const saved = process.env.WEBAUTHN_RP_ID;
    delete process.env.WEBAUTHN_RP_ID;
    try {
      expect(await errorOf(beginDeviceRegistration.run(callableRequest({}, asMember("r1"))))).toEqual({
        code: "failed-precondition",
        message: expect.stringContaining("yapılandırılmamış"),
      });
    } finally {
      process.env.WEBAUTHN_RP_ID = saved;
    }
  });

  it("etkin olmayan (bekleyen) üye cihaz kaydedemez", async () => {
    await createMember("p1", "user", "pending");
    expect((await errorOf(beginDeviceRegistration.run(callableRequest({}, asMember("p1"))))).code).toBe(
      "permission-denied"
    );
  });
});
