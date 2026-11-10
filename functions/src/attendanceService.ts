import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { auditIn, writeAuditLog } from "./auditLogger";
import { defineCallable } from "./callable";
import { ATTENDANCE_CODE_ALPHABET, ATTENDANCE_CODE_LENGTH, ATTENDANCE_SLOT_MS } from "./shared/constants";
import { COLLECTIONS } from "./shared/types";

/**
 * MODÜL 3 — DERS KATILIM KONTROLÜ (Sunucu Tarafı)
 *
 * Akış:
 *  1. Admin `startLectureSession` ile dersi başlatır → oturum `live` olur, HMAC anahtarı
 *     yalnızca sunucuda (`attendance_secrets`, istemciye kapalı) üretilir.
 *  2. Projektör ekranı (yalnızca Admin) `getProjectorCode` ile 15 sn'lik güncel kodu alır.
 *     Kod / anahtar hiçbir zaman hekim istemcisine gönderilmez.
 *  3. Hekim `verifyRealTimeAttendance` ile kodu + kişisel cihaz kimliğini gönderir.
 *  4. Admin `endLectureSession` ile yoklamayı kapatır (süre dolunca da otomatik reddedilir).
 *  Her kayıt `attendance_logs` koleksiyonuna da yazılır → ders ve katılımcı bazlı dashboard.
 *
 * Yetki + istek doğrulaması: `defineCallable` (guards.ts + shared/schemas.ts).
 * F4.1'de: transaction'lar, sayaç deltaları, canlı oturum kilidi, süre dolumu zamanlayıcısı.
 */

/** HMAC çıktısını okunabilir koda çevirir (karışıklık yaratan 0/O/1/I karakterleri yok). */
export function computeSlotCode(secret: string, sessionId: string, slot: number): string {
  const digest = crypto.createHmac("sha256", secret).update(`${sessionId}:${slot}`).digest();
  let out = "";
  for (let i = 0; i < ATTENDANCE_CODE_LENGTH; i++) {
    out += ATTENDANCE_CODE_ALPHABET[digest[i] % ATTENDANCE_CODE_ALPHABET.length];
  }
  return out;
}

function hashDeviceId(deviceId: string): string {
  // Cihaz kimliği veritabanında ham haliyle değil, tek yönlü özet olarak tutulur.
  return crypto.createHash("sha256").update(`pediatrist-device:${deviceId}`).digest("hex");
}

const sessions = () => getFirestore().collection(COLLECTIONS.attendanceSessions);
const secrets = () => getFirestore().collection(COLLECTIONS.attendanceSecrets);

/** Admin: yeni ders yoklaması başlatır. Aynı anda yalnızca bir canlı ders olabilir. */
export const startLectureSession = defineCallable("startLectureSession", "admin", async (data, actor) => {
  const db = getFirestore();
  const live = await sessions().where("status", "==", "live").limit(1).get();
  if (!live.empty) {
    throw new HttpsError("failed-precondition", "Zaten devam eden bir ders yoklaması var. Önce onu bitirin.");
  }

  const sessionRef = sessions().doc();
  const now = Timestamp.now();
  const endsAt = Timestamp.fromMillis(now.toMillis() + data.durationMinutes * 60_000);

  const batch = db.batch();
  batch.set(sessionRef, {
    title: data.title,
    lecturer: data.lecturer,
    category: data.category,
    durationMinutes: data.durationMinutes,
    status: "live",
    startedAt: now,
    endsAt,
    startedBy: actor.uid,
    presentCount: 0,
    excusedCount: 0,
  });
  batch.set(secrets().doc(sessionRef.id), {
    hmacSecret: crypto.randomBytes(32).toString("hex"),
    createdAt: now,
  });
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "ATTENDANCE_SESSION_STARTED",
    resourceType: "attendance",
    resourceId: sessionRef.id,
    metadata: { title: data.title, durationMinutes: data.durationMinutes },
  });
  await batch.commit();

  return { sessionId: sessionRef.id, endsAtMs: endsAt.toMillis() };
});

/** Admin: yoklamayı kapatır ve HMAC anahtarını imha eder. */
export const endLectureSession = defineCallable("endLectureSession", "admin", async (data, actor) => {
  const db = getFirestore();
  const batch = db.batch();
  batch.update(sessions().doc(data.sessionId), {
    status: "closed",
    closedAt: FieldValue.serverTimestamp(),
    closedBy: actor.uid,
  });
  batch.delete(secrets().doc(data.sessionId));
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "ATTENDANCE_SESSION_CLOSED",
    resourceType: "attendance",
    resourceId: data.sessionId,
  });
  await batch.commit();
  return { closed: true as const };
});

/** Admin (projektör): güncel kodu ve yenilenmeye kalan süreyi döndürür. */
export const getProjectorCode = defineCallable("getProjectorCode", "admin", async (data) => {
  const [sessionSnap, secretSnap] = await Promise.all([
    sessions().doc(data.sessionId).get(),
    secrets().doc(data.sessionId).get(),
  ]);
  const session = sessionSnap.data();
  if (!session || session.status !== "live" || !secretSnap.exists) {
    throw new HttpsError("failed-precondition", "Canlı yoklama oturumu bulunamadı.");
  }

  const nowMs = Date.now();
  const slot = Math.floor(nowMs / ATTENDANCE_SLOT_MS);
  return {
    code: computeSlotCode(String(secretSnap.data()!.hmacSecret), data.sessionId, slot),
    msUntilRotation: ATTENDANCE_SLOT_MS - (nowMs % ATTENDANCE_SLOT_MS),
    endsAtMs: (session.endsAt as Timestamp).toMillis(),
  };
});

/** Hekim: kodu ve kişisel cihaz bağını doğrular, katılım kaydını yazar. */
export const verifyRealTimeAttendance = defineCallable("verifyRealTimeAttendance", "member", async (data, actor) => {
  const db = getFirestore();
  const { uid, email: actorEmail, profile } = actor;
  const deviceHash = hashDeviceId(data.deviceId);

  // 1. Oturum canlı ve süresi dolmamış olmalı (yoklamayı yalnızca Admin başlatır)
  const sessionRef = sessions().doc(data.sessionId);
  const session = (await sessionRef.get()).data();
  if (!session || session.status !== "live" || (session.endsAt as Timestamp).toMillis() < Date.now()) {
    throw new HttpsError("failed-precondition", "Bu ders için aktif yoklama bulunmuyor.");
  }

  // 2. Kişisel cihaz bağlama (ham cihaz kimliği saklanmaz, hata mesajında da gösterilmez)
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  if (profile.boundDeviceHash && profile.boundDeviceHash !== deviceHash) {
    await writeAuditLog({
      actorUid: uid,
      actorEmail,
      action: "ATTENDANCE_DEVICE_MISMATCH_BLOCKED",
      resourceType: "attendance",
      resourceId: data.sessionId,
      severity: "WARN",
    });
    throw new HttpsError(
      "failed-precondition",
      "Bu cihaz hesabınıza kayıtlı değil. Cihaz değişikliği için Admin'e başvurun."
    );
  }

  // 3. Kod (bir önceki pencere ağ gecikmesi toleransı olarak kabul edilir)
  const secretSnap = await secrets().doc(data.sessionId).get();
  if (!secretSnap.exists) {
    throw new HttpsError("failed-precondition", "Bu ders için aktif yoklama bulunmuyor.");
  }
  const secret = String(secretSnap.data()!.hmacSecret);
  const slot = Math.floor(Date.now() / ATTENDANCE_SLOT_MS);
  const given = Buffer.from(data.code);
  const valid = [slot, slot - 1].some((s) =>
    crypto.timingSafeEqual(Buffer.from(computeSlotCode(secret, data.sessionId, s)), given)
  );
  if (!valid) {
    await writeAuditLog({
      actorUid: uid,
      actorEmail,
      action: "ATTENDANCE_EXPIRED_OR_INVALID_CODE",
      resourceType: "attendance",
      resourceId: data.sessionId,
      severity: "WARN",
    });
    throw new HttpsError("deadline-exceeded", "Kod geçersiz veya süresi doldu. Projektördeki güncel kodu girin.");
  }

  // 4. Aynı fiziksel cihazdan başka hekim adına yoklama engeli
  const recordsCol = sessionRef.collection(COLLECTIONS.attendanceRecords);
  const sameDevice = await recordsCol.where("deviceHash", "==", deviceHash).get();
  if (sameDevice.docs.some((d) => d.id !== uid)) {
    await writeAuditLog({
      actorUid: uid,
      actorEmail,
      action: "ATTENDANCE_MULTI_ACCOUNT_SAME_DEVICE_BLOCKED",
      resourceType: "attendance",
      resourceId: data.sessionId,
      severity: "CRITICAL",
    });
    throw new HttpsError("already-exists", "Bu cihazdan bu derse başka bir hesap ile yoklama verilmiş.");
  }

  // 5. Kayıt (oturum alt koleksiyonu + dashboard için düz log) — idempotent
  const recordRef = recordsCol.doc(uid);
  const already = await recordRef.get();
  if (already.exists && already.data()?.status === "present") {
    return { verified: true as const, alreadyRecorded: true };
  }

  const record = {
    uid,
    fullName: profile.fullName ?? actorEmail,
    title: profile.title ?? "",
    residencyYear: profile.residencyYear ?? 1,
    verifiedAt: FieldValue.serverTimestamp(),
    // Yalnızca sunucunun doğruladığı yöntem yazılır (istemci beyanı kabul edilmez; WebAuthn → F4.2).
    method: "qr+device_bound",
    deviceHash,
    status: "present",
  };

  const batch = db.batch();
  if (!profile.boundDeviceHash) batch.set(userRef, { boundDeviceHash: deviceHash }, { merge: true });
  batch.set(recordRef, record);
  batch.set(db.collection(COLLECTIONS.attendanceLogs).doc(`${data.sessionId}_${uid}`), {
    ...record,
    sessionId: data.sessionId,
    sessionTitle: session.title,
    lecturer: session.lecturer,
    category: session.category,
    sessionStartedAt: session.startedAt,
  });
  batch.update(sessionRef, { presentCount: FieldValue.increment(1) });
  auditIn(batch, {
    actorUid: uid,
    actorEmail,
    action: "ATTENDANCE_VERIFIED",
    resourceType: "attendance",
    resourceId: data.sessionId,
  });
  await batch.commit();

  return { verified: true as const, alreadyRecorded: false };
});

/** Admin: hekimi derste mazeretli olarak işaretler. */
export const markAttendanceExcused = defineCallable("markAttendanceExcused", "admin", async (data, actor) => {
  const db = getFirestore();
  const [sessionSnap, userSnap] = await Promise.all([
    sessions().doc(data.sessionId).get(),
    db.collection(COLLECTIONS.users).doc(data.targetUid).get(),
  ]);
  if (!sessionSnap.exists || !userSnap.exists) throw new HttpsError("not-found", "Oturum veya hekim bulunamadı.");
  const session = sessionSnap.data()!;
  const user = userSnap.data()!;

  const record = {
    uid: data.targetUid,
    fullName: user.fullName ?? "",
    title: user.title ?? "",
    residencyYear: user.residencyYear ?? 1,
    verifiedAt: FieldValue.serverTimestamp(),
    method: "admin_excused",
    status: "excused",
    excuseNote: data.excuseNote,
    markedBy: actor.uid,
  };
  const batch = db.batch();
  batch.set(sessionSnap.ref.collection(COLLECTIONS.attendanceRecords).doc(data.targetUid), record);
  batch.set(db.collection(COLLECTIONS.attendanceLogs).doc(`${data.sessionId}_${data.targetUid}`), {
    ...record,
    sessionId: data.sessionId,
    sessionTitle: session.title,
    lecturer: session.lecturer,
    category: session.category,
    sessionStartedAt: session.startedAt,
  });
  batch.update(sessionSnap.ref, { excusedCount: FieldValue.increment(1) });
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "ATTENDANCE_MARKED_EXCUSED",
    resourceType: "attendance",
    resourceId: data.sessionId,
    metadata: { targetUid: data.targetUid },
  });
  await batch.commit();

  return { ok: true as const };
});
