import { getFirestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import {
  closeExpiredLectures,
  endLectureSession,
  getProjectorCode,
  markAttendanceExcused,
  startLectureSession,
  verifyRealTimeAttendance,
} from "../src/attendanceService";
import { CALLABLES } from "../src/shared/schemas";
import { updateMemberAccess } from "../src/members";
import { beginAttendanceAssertion } from "../src/webauthn";
import {
  asAdmin,
  asMember,
  attendanceAssertion,
  auditActions,
  callableRequest,
  createMember,
  errorOf,
  registerDevice,
  resetEmulators,
} from "./helpers";
import { SoftAuthenticator } from "./softAuthenticator";

const db = () => getFirestore();
/** Üye uid → bu üyenin kayıtlı yazılım doğrulayıcısı (telefonu). */
let devices: Record<string, SoftAuthenticator> = {};

async function startLive() {
  const res = await startLectureSession.run(
    callableRequest({ title: "  Sabah Dersi ", lecturer: "Dr. X", durationMinutes: 15 }, asAdmin())
  );
  CALLABLES.startLectureSession.response.parse(res);
  const code = await getProjectorCode.run(callableRequest({ sessionId: res.sessionId }, asAdmin()));
  CALLABLES.getProjectorCode.response.parse(code);
  return { sessionId: res.sessionId, code: code.code };
}

beforeEach(async () => {
  await resetEmulators();
  await createMember("admin", "admin", "active");
  await createMember("r1", "user", "active");
  await createMember("r2", "user", "active");
  devices = { r1: await registerDevice("r1"), r2: await registerDevice("r2") };
});

const sessionDoc = async (id: string) => (await db().doc(`attendance_sessions/${id}`).get()).data();
/** Gerçek akış: challenge al → telefonla imzala → kod + imzayı gönder. */
const verify = async (sessionId: string, code: string, uid: string) =>
  verifyRealTimeAttendance.run(
    callableRequest(
      { sessionId, code, assertion: await attendanceAssertion(uid, sessionId, devices[uid]) },
      asMember(uid)
    )
  );
const send = (sessionId: string, code: string, uid: string, assertion: unknown) =>
  verifyRealTimeAttendance.run(callableRequest({ sessionId, code, assertion }, asMember(uid)));
const excuse = (sessionId: string, targetUid: string, excuseNote = "Nöbet ertesi") =>
  markAttendanceExcused.run(callableRequest({ sessionId, targetUid, excuseNote }, asAdmin()));
/** Dersin bitiş anını geçmişe çeker (süre dolumu senaryoları). */
const expire = (id: string) =>
  db()
    .doc(`attendance_sessions/${id}`)
    .update({ endsAt: Timestamp.fromMillis(Date.now() - 1000) });

describe("yoklama akışı (sunucu)", () => {
  it("admin başlatır, asistan kod + passkey imzasıyla katılır; kayıt, log, sayaç, sayaç (doğrulayıcı) ve denetim kaydı", async () => {
    const { sessionId, code } = await startLive();
    const session = (await db().collection("attendance_sessions").doc(sessionId).get()).data();
    expect(session).toMatchObject({ title: "Sabah Dersi", category: "Genel", status: "live", startedBy: "admin" });

    const res = await verify(sessionId, code.toLowerCase(), "r1");
    expect(CALLABLES.verifyRealTimeAttendance.response.parse(res)).toEqual({ verified: true, alreadyRecorded: false });

    const record = (await db().doc(`attendance_sessions/${sessionId}/records/r1`).get()).data();
    expect(record).toMatchObject({ status: "present", method: "qr+webauthn", fullName: "Test r1" });
    expect(record).not.toHaveProperty("deviceHash");
    expect((await db().doc(`attendance_logs/${sessionId}_r1`).get()).data()).toMatchObject({
      sessionTitle: "Sabah Dersi",
    });
    expect((await sessionDoc(sessionId))?.presentCount).toBe(1);
    expect((await db().doc("users/r1").get()).data()?.webauthn?.counter).toBe(devices.r1.counter);
    expect(await auditActions()).toEqual(expect.arrayContaining(["ATTENDANCE_SESSION_STARTED", "ATTENDANCE_VERIFIED"]));

    expect(await verify(sessionId, code, "r1")).toEqual({ verified: true, alreadyRecorded: true });
  });

  it("yanlış kod reddedilir ve uyarı seviyesinde denetim kaydı düşer (imza geçerli olsa bile)", async () => {
    const { sessionId, code } = await startLive();
    const wrong = code === "AAAAAA" ? "BBBBBB" : "AAAAAA";
    expect((await errorOf(verify(sessionId, wrong, "r1"))).code).toBe("deadline-exceeded");
    expect(await auditActions()).toContain("ATTENDANCE_EXPIRED_OR_INVALID_CODE");
    expect((await sessionDoc(sessionId))?.presentCount).toBe(0);
  });

  it("eski sözleşme (deviceId, imzasız) reddedilir", async () => {
    const { sessionId, code } = await startLive();
    const err = await errorOf(
      verifyRealTimeAttendance.run(callableRequest({ sessionId, code, deviceId: "a".repeat(32) }, asMember("r1")))
    );
    expect(err.code).toBe("invalid-argument");
  });

  it("aynı ders için ikinci canlı ders başlatılamaz; bitirilen dersin sırrı silinir ve kod üretilmez", async () => {
    const { sessionId } = await startLive();
    const second = await errorOf(
      startLectureSession.run(callableRequest({ title: "İkinci", lecturer: "Dr. Y", durationMinutes: 5 }, asAdmin()))
    );
    expect(second.code).toBe("failed-precondition");

    CALLABLES.endLectureSession.response.parse(await endLectureSession.run(callableRequest({ sessionId }, asAdmin())));
    expect((await db().doc(`attendance_secrets/${sessionId}`).get()).exists).toBe(false);
    expect((await errorOf(getProjectorCode.run(callableRequest({ sessionId }, asAdmin())))).code).toBe(
      "failed-precondition"
    );
  });

  it("asistan projektör kodu isteyemez; admin mazeret işaretleyebilir", async () => {
    const { sessionId } = await startLive();
    expect((await errorOf(getProjectorCode.run(callableRequest({ sessionId }, asMember("r1"))))).code).toBe(
      "permission-denied"
    );
    const res = await markAttendanceExcused.run(
      callableRequest({ sessionId, targetUid: "r2", excuseNote: "  Nöbet ertesi  " }, asAdmin())
    );
    CALLABLES.markAttendanceExcused.response.parse(res);
    expect((await db().doc(`attendance_sessions/${sessionId}/records/r2`).get()).data()).toMatchObject({
      status: "excused",
      excuseNote: "Nöbet ertesi",
      markedBy: "admin",
    });
  });
});

describe("F4.2: passkey ile cihaz doğrulaması", () => {
  it("cihazı kayıtlı olmayan üye challenge alamaz; açık Türkçe yönlendirme", async () => {
    await createMember("r3", "user", "active");
    const { sessionId } = await startLive();
    const err = await errorOf(beginAttendanceAssertion.run(callableRequest({ sessionId }, asMember("r3"))));
    expect(err).toEqual({
      code: "failed-precondition",
      message: expect.stringContaining("yoklama cihazı olarak kaydedin"),
    });
  });

  it("geçersiz imza reddedilir (kritik denetim kaydı), yoklama yazılmaz", async () => {
    const { sessionId, code } = await startLive();
    const assertion = await attendanceAssertion("r1", sessionId, devices.r1, { tamperSignature: true });
    const err = await errorOf(send(sessionId, code, "r1", assertion));
    expect(err.code).toBe("permission-denied");
    expect(await auditActions()).toContain("ATTENDANCE_DEVICE_ASSERTION_REJECTED");
    expect((await sessionDoc(sessionId))?.presentCount).toBe(0);
  });

  it("kullanıcı doğrulaması (biyometrik/PIN) olmadan imza reddedilir", async () => {
    const { sessionId, code } = await startLive();
    const assertion = await attendanceAssertion("r1", sessionId, devices.r1, { withoutUserVerification: true });
    expect((await errorOf(send(sessionId, code, "r1", assertion))).code).toBe("permission-denied");
  });

  it("başka sitede üretilmiş imza (oltalama kökeni) reddedilir", async () => {
    const { sessionId, code } = await startLive();
    const assertion = await attendanceAssertion("r1", sessionId, devices.r1, { origin: "https://pediatrist.evil" });
    expect((await errorOf(send(sessionId, code, "r1", assertion))).code).toBe("permission-denied");
  });

  it("başka hekimin telefonuyla (başka credential) imza reddedilir", async () => {
    const { sessionId, code } = await startLive();
    // r2'nin telefonu, r1'in challenge'ını imzalar.
    const { options } = await beginAttendanceAssertion.run(callableRequest({ sessionId }, asMember("r1")));
    expect((await errorOf(send(sessionId, code, "r1", devices.r2.assert(options)))).code).toBe("permission-denied");
  });

  it("aynı imza tekrar gönderilemez (tek kullanımlık challenge)", async () => {
    const { sessionId, code } = await startLive();
    await excuse(sessionId, "r1");
    const assertion = await attendanceAssertion("r1", sessionId, devices.r1);
    await send(sessionId, code, "r1", assertion);
    const replay = await errorOf(send(sessionId, code, "r1", assertion));
    expect(replay.code).toBe("deadline-exceeded");
    expect(await auditActions()).toContain("ATTENDANCE_DEVICE_CHALLENGE_EXPIRED_OR_REUSED");
  });

  it("doğrulayıcı sayacı geri giderse (kopyalanmış anahtar) reddedilir", async () => {
    const { sessionId, code } = await startLive();
    await verify(sessionId, code, "r1");
    const stored = (await db().doc("users/r1").get()).data()?.webauthn?.counter as number;
    const assertion = await attendanceAssertion("r1", sessionId, devices.r1, { counter: stored });
    expect((await errorOf(send(sessionId, code, "r1", assertion))).code).toBe("permission-denied");
  });

  it("challenge derse bağlıdır: başka dersin challenge'ıyla imza geçmez", async () => {
    const first = await startLive();
    const assertion = await attendanceAssertion("r1", first.sessionId, devices.r1);
    await endLectureSession.run(callableRequest({ sessionId: first.sessionId }, asAdmin()));
    const second = await startLive();
    expect((await errorOf(send(second.sessionId, second.code, "r1", assertion))).code).toBe("deadline-exceeded");
  });

  it("admin cihazı sıfırlayınca passkey bağı silinir; yeni telefon kaydedilebilir", async () => {
    await updateMemberAccess.run(callableRequest({ targetUid: "r1", resetBoundDevice: true }, asAdmin()));
    expect((await db().doc("users/r1").get()).data()).not.toHaveProperty("webauthn");
    // Sıfırlama oturumları da iptal eder (tokensValidAfter = şimdi). Üye yeniden giriş yapmış gibi:
    // test token'ı `auth_time = şimdi` taşıdığı için iptal anını bir saniye geriye alıyoruz.
    await db()
      .doc("users/r1")
      .update({ tokensValidAfter: Math.floor(Date.now() / 1000) - 1 });
    const { sessionId, code } = await startLive();
    expect((await errorOf(beginAttendanceAssertion.run(callableRequest({ sessionId }, asMember("r1"))))).code).toBe(
      "failed-precondition"
    );
    devices.r1 = await registerDevice("r1");
    expect(await verify(sessionId, code, "r1")).toEqual({ verified: true, alreadyRecorded: false });
  });
});

describe("F4.1: transaction'lar ve sayaçlar", () => {
  it("aynı imzayla eşzamanlı iki istek: biri kaydedilir, diğeri tekrar oynatma olarak reddedilir; sayaç 1", async () => {
    const { sessionId, code } = await startLive();
    const assertion = await attendanceAssertion("r1", sessionId, devices.r1);
    const results = await Promise.all([
      errorOf(send(sessionId, code, "r1", assertion)),
      errorOf(send(sessionId, code, "r1", assertion)),
    ]);
    expect(results.map((r) => r.code).sort()).toEqual(["deadline-exceeded", "ok"]);
    expect((await sessionDoc(sessionId))?.presentCount).toBe(1);
    expect((await auditActions()).filter((a) => a === "ATTENDANCE_VERIFIED")).toHaveLength(1);
  });

  it("farklı hekimlerden eşzamanlı yoklama: ikisi de sayılır", async () => {
    const { sessionId, code } = await startLive();
    await Promise.all([verify(sessionId, code, "r1"), verify(sessionId, code, "r2")]);
    expect((await sessionDoc(sessionId))?.presentCount).toBe(2);
  });

  it("eşzamanlı iki ders başlatma isteğinden yalnızca biri geçer (kilit)", async () => {
    const start = () =>
      errorOf(
        startLectureSession.run(callableRequest({ title: "Ders", lecturer: "Dr. X", durationMinutes: 10 }, asAdmin()))
      );
    const results = await Promise.all([start(), start()]);
    expect(results.map((r) => r.code).sort()).toEqual(["failed-precondition", "ok"]);
    expect((await db().collection("attendance_sessions").where("status", "==", "live").get()).size).toBe(1);
  });

  it("beklenen katılımcılar: dersin başladığı andaki etkin hekimler (admin ve bekleyen hariç)", async () => {
    await createMember("p1", "user", "pending");
    const { sessionId } = await startLive();
    expect(await sessionDoc(sessionId)).toMatchObject({ expectedAttendees: ["r1", "r2"], expectedCount: 2 });
  });

  it("mazeretli → katıldı: katılan +1, mazeretli −1", async () => {
    const { sessionId, code } = await startLive();
    await excuse(sessionId, "r1");
    expect(await sessionDoc(sessionId)).toMatchObject({ presentCount: 0, excusedCount: 1 });
    await verify(sessionId, code, "r1");
    expect(await sessionDoc(sessionId)).toMatchObject({ presentCount: 1, excusedCount: 0 });
    expect((await db().doc(`attendance_sessions/${sessionId}/records/r1`).get()).data()).toMatchObject({
      status: "present",
      method: "qr+webauthn",
    });
  });

  it("tekrar mazeret: sayaç artmaz, not güncellenir; katılmış hekim mazeretliye çevrilmez", async () => {
    const { sessionId, code } = await startLive();
    await excuse(sessionId, "r2", "İlk not");
    await excuse(sessionId, "r2", "Düzeltilmiş not");
    expect((await sessionDoc(sessionId))?.excusedCount).toBe(1);
    expect((await db().doc(`attendance_sessions/${sessionId}/records/r2`).get()).data()?.excuseNote).toBe(
      "Düzeltilmiş not"
    );
    expect(await auditActions()).toContain("ATTENDANCE_EXCUSE_UPDATED");

    await verify(sessionId, code, "r1");
    const err = await errorOf(excuse(sessionId, "r1"));
    expect(err).toEqual({ code: "failed-precondition", message: expect.stringContaining("katılmış") });
    expect(await sessionDoc(sessionId)).toMatchObject({ presentCount: 1, excusedCount: 1 });
  });

  it("kapanmış derse sonradan mazeret işlenebilir; olmayan ders/hekim not-found", async () => {
    const { sessionId } = await startLive();
    await endLectureSession.run(callableRequest({ sessionId }, asAdmin()));
    await excuse(sessionId, "r2");
    expect((await sessionDoc(sessionId))?.excusedCount).toBe(1);
    expect((await errorOf(excuse("yok", "r2"))).code).toBe("not-found");
    expect((await errorOf(excuse(sessionId, "hayalet"))).code).toBe("not-found");
  });
});

describe("F4.1: ders sonu ve süre dolumu", () => {
  it("bitirme: olmayan ders not-found; ikinci bitirme failed-precondition; kilit bırakılır, yeni ders başlar", async () => {
    expect((await errorOf(endLectureSession.run(callableRequest({ sessionId: "yok" }, asAdmin())))).code).toBe(
      "not-found"
    );
    const { sessionId } = await startLive();
    await endLectureSession.run(callableRequest({ sessionId }, asAdmin()));
    expect(await sessionDoc(sessionId)).toMatchObject({ status: "closed", closedBy: "admin", closeReason: "manual" });
    expect((await db().doc("attendance_meta/live").get()).exists).toBe(false);
    expect((await errorOf(endLectureSession.run(callableRequest({ sessionId }, asAdmin())))).code).toBe(
      "failed-precondition"
    );
    await startLive();
  });

  it("süresi dolmuş derste kod üretilmez ve yoklama alınmaz", async () => {
    const { sessionId, code } = await startLive();
    await expire(sessionId);
    expect((await errorOf(getProjectorCode.run(callableRequest({ sessionId }, asAdmin())))).message).toContain(
      "süresi doldu"
    );
    expect((await errorOf(verify(sessionId, code, "r1"))).code).toBe("failed-precondition");
    expect((await sessionDoc(sessionId))?.presentCount).toBe(0);
  });

  it("closeExpiredLectures: süresi dolanı kapatır (sır ve kilit silinir, denetim kaydı), dolmayana dokunmaz, tekrar çağrı boş", async () => {
    const first = await startLive();
    await expire(first.sessionId);
    expect(await closeExpiredLectures()).toEqual([first.sessionId]);
    expect(await sessionDoc(first.sessionId)).toMatchObject({
      status: "closed",
      closedBy: "system",
      closeReason: "expired",
    });
    expect((await db().doc(`attendance_secrets/${first.sessionId}`).get()).exists).toBe(false);
    expect((await db().doc("attendance_meta/live").get()).exists).toBe(false);
    expect(await auditActions()).toContain("ATTENDANCE_SESSION_EXPIRED");
    expect(await closeExpiredLectures()).toEqual([]);

    const second = await startLive();
    expect(await closeExpiredLectures()).toEqual([]);
    expect((await sessionDoc(second.sessionId))?.status).toBe("live");
  });

  it("kilit süresi dolmuş bir derse aitse yeni ders başlatma onu kapatıp devam eder (zamanlayıcı beklenmez)", async () => {
    const old = await startLive();
    await expire(old.sessionId);
    await db()
      .doc("attendance_meta/live")
      .update({ endsAt: Timestamp.fromMillis(Date.now() - 1000) });
    const next = await startLive();
    expect(await sessionDoc(old.sessionId)).toMatchObject({ status: "closed", closeReason: "expired" });
    expect((await db().doc("attendance_meta/live").get()).data()?.sessionId).toBe(next.sessionId);
  });
});
