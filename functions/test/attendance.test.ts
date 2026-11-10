import { getFirestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import {
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
