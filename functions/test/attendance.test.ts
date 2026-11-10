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
import { asAdmin, asMember, auditActions, callableRequest, createMember, errorOf, resetEmulators } from "./helpers";

const db = () => getFirestore();
const DEVICE_A = "a".repeat(32);
const DEVICE_B = "b".repeat(32);

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
});

const sessionDoc = async (id: string) => (await db().doc(`attendance_sessions/${id}`).get()).data();
const verify = (sessionId: string, code: string, uid: string, deviceId: string) =>
  verifyRealTimeAttendance.run(callableRequest({ sessionId, code, deviceId }, asMember(uid)));
const excuse = (sessionId: string, targetUid: string, excuseNote = "Nöbet ertesi") =>
  markAttendanceExcused.run(callableRequest({ sessionId, targetUid, excuseNote }, asAdmin()));
/** Dersin bitiş anını geçmişe çeker (süre dolumu senaryoları). */
const expire = (id: string) =>
  db()
    .doc(`attendance_sessions/${id}`)
    .update({ endsAt: Timestamp.fromMillis(Date.now() - 1000) });

describe("yoklama akışı (sunucu)", () => {
  it("admin başlatır, asistan projektör koduyla katılır; kayıt, log, sayaç ve denetim kaydı yazılır", async () => {
    const { sessionId, code } = await startLive();
    const session = (await db().collection("attendance_sessions").doc(sessionId).get()).data();
    expect(session).toMatchObject({ title: "Sabah Dersi", category: "Genel", status: "live", startedBy: "admin" });

    const res = await verifyRealTimeAttendance.run(
      callableRequest({ sessionId, code: code.toLowerCase(), deviceId: DEVICE_A }, asMember("r1"))
    );
    expect(CALLABLES.verifyRealTimeAttendance.response.parse(res)).toEqual({ verified: true, alreadyRecorded: false });

    const record = (await db().doc(`attendance_sessions/${sessionId}/records/r1`).get()).data();
    expect(record).toMatchObject({ status: "present", method: "qr+device_bound", fullName: "Test r1" });
    expect((await db().doc(`attendance_logs/${sessionId}_r1`).get()).data()).toMatchObject({
      sessionTitle: "Sabah Dersi",
    });
    expect((await db().doc(`attendance_sessions/${sessionId}`).get()).data()?.presentCount).toBe(1);
    expect(await auditActions()).toEqual(expect.arrayContaining(["ATTENDANCE_SESSION_STARTED", "ATTENDANCE_VERIFIED"]));

    const again = await verifyRealTimeAttendance.run(
      callableRequest({ sessionId, code, deviceId: DEVICE_A }, asMember("r1"))
    );
    expect(again).toEqual({ verified: true, alreadyRecorded: true });
  });

  it("istemcinin 'biyometrik doğrulandı' beyanı kayda yöntem olarak yazılmaz", async () => {
    const { sessionId, code } = await startLive();
    await verifyRealTimeAttendance.run(
      callableRequest({ sessionId, code, deviceId: DEVICE_A, webAuthnVerified: true }, asMember("r1"))
    );
    expect((await db().doc(`attendance_sessions/${sessionId}/records/r1`).get()).data()?.method).toBe(
      "qr+device_bound"
    );
  });

  it("yanlış kod reddedilir ve uyarı seviyesinde denetim kaydı düşer", async () => {
    const { sessionId, code } = await startLive();
    const wrong = code === "AAAAAA" ? "BBBBBB" : "AAAAAA";
    const err = await errorOf(
      verifyRealTimeAttendance.run(callableRequest({ sessionId, code: wrong, deviceId: DEVICE_A }, asMember("r1")))
    );
    expect(err.code).toBe("deadline-exceeded");
    expect(await auditActions()).toContain("ATTENDANCE_EXPIRED_OR_INVALID_CODE");
  });

  it("eski parametre adlarıyla (dynamicCode) gelen istek reddedilir", async () => {
    const { sessionId, code } = await startLive();
    const err = await errorOf(
      verifyRealTimeAttendance.run(
        callableRequest({ sessionId, dynamicCode: code, clientDeviceSecret: DEVICE_A }, asMember("r1"))
      )
    );
    expect(err.code).toBe("invalid-argument");
  });

  it("kayıtlı cihazı farklı olan asistan ve aynı cihazdan ikinci hesap engellenir", async () => {
    const { sessionId, code } = await startLive();
    await verifyRealTimeAttendance.run(callableRequest({ sessionId, code, deviceId: DEVICE_A }, asMember("r1")));
    expect((await db().doc("users/r1").get()).data()?.boundDeviceHash).toMatch(/^[0-9a-f]{64}$/);

    const sameDevice = await errorOf(
      verifyRealTimeAttendance.run(callableRequest({ sessionId, code, deviceId: DEVICE_A }, asMember("r2")))
    );
    expect(sameDevice.code).toBe("already-exists");
    expect(await auditActions()).toContain("ATTENDANCE_MULTI_ACCOUNT_SAME_DEVICE_BLOCKED");

    await db()
      .doc("users/r2")
      .update({ boundDeviceHash: "x".repeat(64) });
    const mismatch = await errorOf(
      verifyRealTimeAttendance.run(callableRequest({ sessionId, code, deviceId: DEVICE_B }, asMember("r2")))
    );
    expect(mismatch.code).toBe("failed-precondition");
  });

  it("aynı anda ikinci canlı ders başlatılamaz; bitirilen dersin sırrı silinir ve kod üretilmez", async () => {
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

describe("F4.1: transaction'lar ve sayaçlar", () => {
  it("aynı hekimden eşzamanlı iki yoklama: sayaç bir kez artar, biri 'zaten kayıtlı' döner", async () => {
    const { sessionId, code } = await startLive();
    const results = await Promise.all([
      verify(sessionId, code, "r1", DEVICE_A),
      verify(sessionId, code, "r1", DEVICE_A),
    ]);
    expect(results.map((r) => r.alreadyRecorded).sort()).toEqual([false, true]);
    expect((await sessionDoc(sessionId))?.presentCount).toBe(1);
    expect((await auditActions()).filter((a) => a === "ATTENDANCE_VERIFIED")).toHaveLength(1);
  });

  it("farklı hekimlerden eşzamanlı yoklama: ikisi de sayılır", async () => {
    const { sessionId, code } = await startLive();
    await Promise.all([verify(sessionId, code, "r1", DEVICE_A), verify(sessionId, code, "r2", DEVICE_B)]);
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
    await verify(sessionId, code, "r1", DEVICE_A);
    expect(await sessionDoc(sessionId)).toMatchObject({ presentCount: 1, excusedCount: 0 });
    expect((await db().doc(`attendance_sessions/${sessionId}/records/r1`).get()).data()).toMatchObject({
      status: "present",
      method: "qr+device_bound",
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

    await verify(sessionId, code, "r1", DEVICE_A);
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
    expect((await errorOf(verify(sessionId, code, "r1", DEVICE_A))).code).toBe("failed-precondition");
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
