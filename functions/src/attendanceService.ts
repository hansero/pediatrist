import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { writeAuditLog } from "./auditLogger";

/**
 * MODÜL 3 — DERS KATILIM KONTROLÜ (Sunucu Tarafı)
 *
 * Akış:
 *  1. Admin `startLectureSession` ile dersi başlatır → oturum `live` olur, HMAC anahtarı
 *     yalnızca sunucuda (`attendance_secrets`, istemciye kapalı) üretilir.
 *  2. Projektör ekranı (yalnızca Admin) `getProjectorCode` ile 15 sn'lik güncel kodu alır.
 *     Kod / anahtar hiçbir zaman User istemcisine gönderilmez.
 *  3. Hekim `verifyRealTimeAttendance` ile kodu + kişisel cihaz kimliğini gönderir.
 *  4. Admin `endLectureSession` ile yoklamayı kapatır (süre dolunca da otomatik reddedilir).
 *  Her kayıt `attendance_logs` koleksiyonuna da yazılır → ders ve katılımcı bazlı dashboard.
 */

const REGION = "europe-west1";
const SLOT_MS = 15_000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function assertAdmin(request: CallableRequest<unknown>) {
  if (!request.auth || request.auth.token.role !== "admin" || request.auth.token.status !== "active") {
    throw new HttpsError("permission-denied", "Bu işlem yalnızca aktif Admin yetkisiyle yapılabilir.");
  }
  return request.auth;
}

function assertActiveMember(request: CallableRequest<unknown>) {
  if (!request.auth || request.auth.token.status !== "active") {
    throw new HttpsError("permission-denied", "Sadece aktif klinik üyeleri yoklama verebilir.");
  }
  return request.auth;
}

/** HMAC çıktısını okunabilir 6 karakterlik koda çevirir (karışıklık yaratan 0/O/1/I harfleri yok). */
function computeSlotCode(secret: string, sessionId: string, slot: number): string {
  const digest = crypto.createHmac("sha256", secret).update(`${sessionId}:${slot}`).digest();
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[digest[i] % CODE_ALPHABET.length];
  return out;
}

function hashDeviceId(deviceId: string): string {
  // Cihaz kimliği veritabanında ham haliyle değil, tek yönlü özet olarak tutulur.
  return crypto.createHash("sha256").update(`pediatrist-device:${deviceId}`).digest("hex");
}

/** Admin: yeni ders yoklaması başlatır. Aynı anda yalnızca bir canlı ders olabilir. */
export const startLectureSession = onCall({ enforceAppCheck: true, region: REGION }, async (request) => {
  const auth = assertAdmin(request);
  const { title, lecturer, category, durationMinutes } = (request.data ?? {}) as {
    title?: string;
    lecturer?: string;
    category?: string;
    durationMinutes?: number;
  };

  const duration = Number(durationMinutes);
  if (!title?.trim() || !lecturer?.trim() || !Number.isFinite(duration) || duration < 1 || duration > 240) {
    throw new HttpsError("invalid-argument", "Ders başlığı, eğitici ve 1–240 dk arası yoklama süresi zorunludur.");
  }

  const db = admin.firestore();
  const live = await db.collection("attendance_sessions").where("status", "==", "live").limit(1).get();
  if (!live.empty) {
    throw new HttpsError("failed-precondition", "Zaten devam eden bir ders yoklaması var. Önce onu bitirin.");
  }

  const sessionRef = db.collection("attendance_sessions").doc();
  const now = admin.firestore.Timestamp.now();
  const endsAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + duration * 60_000);

  const batch = db.batch();
  batch.set(sessionRef, {
    title: title.trim(),
    lecturer: lecturer.trim(),
    category: (category ?? "Genel").trim(),
    durationMinutes: duration,
    status: "live",
    startedAt: now,
    endsAt,
    startedBy: auth.uid,
    presentCount: 0,
    excusedCount: 0,
  });
  batch.set(db.collection("attendance_secrets").doc(sessionRef.id), {
    hmacSecret: crypto.randomBytes(32).toString("hex"),
    createdAt: now,
  });
  await batch.commit();

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.token.email ?? "unknown",
    action: "ATTENDANCE_SESSION_STARTED",
    resourceType: "attendance",
    resourceId: sessionRef.id,
    metadata: { title: title.trim(), durationMinutes: duration },
  });

  return { sessionId: sessionRef.id, endsAtMs: endsAt.toMillis() };
});

/** Admin: yoklamayı kapatır ve HMAC anahtarını imha eder. */
export const endLectureSession = onCall({ enforceAppCheck: true, region: REGION }, async (request) => {
  const auth = assertAdmin(request);
  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError("invalid-argument", "Oturum kimliği zorunludur.");

  const db = admin.firestore();
  const batch = db.batch();
  batch.update(db.collection("attendance_sessions").doc(sessionId), {
    status: "closed",
    closedAt: admin.firestore.FieldValue.serverTimestamp(),
    closedBy: auth.uid,
  });
  batch.delete(db.collection("attendance_secrets").doc(sessionId));
  await batch.commit();

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.token.email ?? "unknown",
    action: "ATTENDANCE_SESSION_CLOSED",
    resourceType: "attendance",
    resourceId: sessionId,
  });
  return { closed: true };
});

/** Admin (projektör): güncel 15 sn'lik kodu ve yenilenmeye kalan süreyi döndürür. */
export const getProjectorCode = onCall({ enforceAppCheck: true, region: REGION }, async (request) => {
  assertAdmin(request);
  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError("invalid-argument", "Oturum kimliği zorunludur.");

  const db = admin.firestore();
  const [sessionSnap, secretSnap] = await Promise.all([
    db.collection("attendance_sessions").doc(sessionId).get(),
    db.collection("attendance_secrets").doc(sessionId).get(),
  ]);
  const session = sessionSnap.data();
  if (!session || session.status !== "live" || !secretSnap.exists) {
    throw new HttpsError("failed-precondition", "Canlı yoklama oturumu bulunamadı.");
  }

  const nowMs = Date.now();
  const slot = Math.floor(nowMs / SLOT_MS);
  return {
    code: computeSlotCode(String(secretSnap.data()!.hmacSecret), sessionId, slot),
    msUntilRotation: SLOT_MS - (nowMs % SLOT_MS),
    endsAtMs: (session.endsAt as admin.firestore.Timestamp).toMillis(),
  };
});

/** Hekim: 15 sn'lik kodu ve kişisel cihaz bağını doğrular, katılım kaydını yazar. */
export const verifyRealTimeAttendance = onCall({ enforceAppCheck: true, region: REGION }, async (request) => {
  const auth = assertActiveMember(request);
  const { sessionId, dynamicToken, deviceId, webAuthnVerified } = (request.data ?? {}) as {
    sessionId?: string;
    dynamicToken?: string;
    deviceId?: string;
    webAuthnVerified?: boolean;
  };

  if (!sessionId || !dynamicToken || !deviceId) {
    throw new HttpsError("invalid-argument", "Oturum, dinamik kod ve kişisel cihaz kimliği zorunludur.");
  }

  const db = admin.firestore();
  const uid = auth.uid;
  const actorEmail = auth.token.email ?? "unknown";
  const deviceHash = hashDeviceId(deviceId);

  // 1. Oturum canlı ve süresi dolmamış olmalı (yoklamayı yalnızca Admin başlatır)
  const sessionRef = db.collection("attendance_sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  const session = sessionSnap.data();
  if (!session || session.status !== "live" || (session.endsAt as admin.firestore.Timestamp).toMillis() < Date.now()) {
    throw new HttpsError("failed-precondition", "Bu ders için aktif yoklama bulunmuyor.");
  }

  // 2. Kişisel cihaz bağlama (ham cihaz kimliği saklanmaz, hata mesajında da gösterilmez)
  const userRef = db.collection("users").doc(uid);
  const userData = (await userRef.get()).data() ?? {};
  if (userData.boundDeviceHash && userData.boundDeviceHash !== deviceHash) {
    await writeAuditLog({
      actorUid: uid,
      actorEmail,
      action: "ATTENDANCE_DEVICE_MISMATCH_BLOCKED",
      resourceType: "attendance",
      resourceId: sessionId,
      severity: "WARN",
    });
    throw new HttpsError("failed-precondition", "Bu cihaz hesabınıza kayıtlı değil. Cihaz değişikliği için Admin'e başvurun.");
  }

  // 3. 15 sn'lik HMAC kodu (bir önceki pencere ağ gecikmesi toleransı olarak kabul edilir)
  const secretSnap = await db.collection("attendance_secrets").doc(sessionId).get();
  if (!secretSnap.exists) {
    throw new HttpsError("failed-precondition", "Bu ders için aktif yoklama bulunmuyor.");
  }
  const secret = String(secretSnap.data()!.hmacSecret);
  const slot = Math.floor(Date.now() / SLOT_MS);
  const token = dynamicToken.trim().toUpperCase();
  const valid = [slot, slot - 1].some((s) => {
    const expected = Buffer.from(computeSlotCode(secret, sessionId, s));
    const given = Buffer.from(token.padEnd(6).slice(0, 6));
    return crypto.timingSafeEqual(expected, given);
  });
  if (!valid) {
    await writeAuditLog({
      actorUid: uid,
      actorEmail,
      action: "ATTENDANCE_EXPIRED_OR_INVALID_CODE",
      resourceType: "attendance",
      resourceId: sessionId,
      severity: "WARN",
    });
    throw new HttpsError("deadline-exceeded", "Kod geçersiz veya süresi doldu. Projektördeki güncel kodu okutun.");
  }

  // 4. Aynı fiziksel cihazdan başka hekim adına yoklama engeli
  const recordsCol = sessionRef.collection("records");
  const sameDevice = await recordsCol.where("deviceHash", "==", deviceHash).get();
  if (sameDevice.docs.some((d) => d.id !== uid)) {
    await writeAuditLog({
      actorUid: uid,
      actorEmail,
      action: "ATTENDANCE_MULTI_ACCOUNT_SAME_DEVICE_BLOCKED",
      resourceType: "attendance",
      resourceId: sessionId,
      severity: "CRITICAL",
    });
    throw new HttpsError("already-exists", "Bu cihazdan bu derse başka bir hesap ile yoklama verilmiş.");
  }

  // 5. Kayıt (oturum alt koleksiyonu + dashboard için düz log) — idempotent
  const recordRef = recordsCol.doc(uid);
  const already = await recordRef.get();
  if (already.exists && already.data()?.status === "present") {
    return { verified: true, alreadyRecorded: true };
  }

  const record = {
    uid,
    fullName: userData.fullName ?? actorEmail,
    title: userData.title ?? "",
    residencyYear: userData.residencyYear ?? 1,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    method: webAuthnVerified ? "qr+webauthn" : "qr+device_bound",
    deviceHash,
    status: "present",
  };

  const batch = db.batch();
  if (!userData.boundDeviceHash) batch.set(userRef, { boundDeviceHash: deviceHash }, { merge: true });
  batch.set(recordRef, record);
  batch.set(db.collection("attendance_logs").doc(`${sessionId}_${uid}`), {
    ...record,
    sessionId,
    sessionTitle: session.title,
    lecturer: session.lecturer,
    category: session.category,
    sessionStartedAt: session.startedAt,
  });
  batch.update(sessionRef, { presentCount: admin.firestore.FieldValue.increment(1) });
  await batch.commit();

  await writeAuditLog({
    actorUid: uid,
    actorEmail,
    action: "ATTENDANCE_VERIFIED",
    resourceType: "attendance",
    resourceId: sessionId,
  });

  return { verified: true, alreadyRecorded: false };
});

/** Admin: hekimi derste mazeretli olarak işaretler. */
export const markAttendanceExcused = onCall({ enforceAppCheck: true, region: REGION }, async (request) => {
  const auth = assertAdmin(request);
  const { sessionId, targetUid, excuseNote } = (request.data ?? {}) as {
    sessionId?: string;
    targetUid?: string;
    excuseNote?: string;
  };
  if (!sessionId || !targetUid) throw new HttpsError("invalid-argument", "Oturum ve hekim zorunludur.");

  const db = admin.firestore();
  const [sessionSnap, userSnap] = await Promise.all([
    db.collection("attendance_sessions").doc(sessionId).get(),
    db.collection("users").doc(targetUid).get(),
  ]);
  if (!sessionSnap.exists || !userSnap.exists) throw new HttpsError("not-found", "Oturum veya hekim bulunamadı.");
  const session = sessionSnap.data()!;
  const user = userSnap.data()!;

  const record = {
    uid: targetUid,
    fullName: user.fullName ?? "",
    title: user.title ?? "",
    residencyYear: user.residencyYear ?? 1,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    method: "admin_excused",
    status: "excused",
    excuseNote: (excuseNote ?? "").slice(0, 200),
    markedBy: auth.uid,
  };
  const batch = db.batch();
  batch.set(sessionSnap.ref.collection("records").doc(targetUid), record);
  batch.set(db.collection("attendance_logs").doc(`${sessionId}_${targetUid}`), {
    ...record,
    sessionId,
    sessionTitle: session.title,
    lecturer: session.lecturer,
    category: session.category,
    sessionStartedAt: session.startedAt,
  });
  batch.update(sessionSnap.ref, { excusedCount: admin.firestore.FieldValue.increment(1) });
  await batch.commit();

  await writeAuditLog({
    actorUid: auth.uid,
    actorEmail: auth.token.email ?? "unknown",
    action: "ATTENDANCE_MARKED_EXCUSED",
    resourceType: "attendance",
    resourceId: sessionId,
    metadata: { targetUid },
  });
  return { ok: true };
});
