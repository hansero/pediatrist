import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp, getFirestore, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { auditIn, writeAuditLog } from "./auditLogger";
import { defineCallable } from "./callable";
import { enforceRateLimit } from "./rateLimit";
import { currentContext } from "./requestContext";
import { ATTENDANCE_CODE_ALPHABET, ATTENDANCE_CODE_LENGTH, ATTENDANCE_SLOT_MS } from "./shared/constants";
import { COLLECTIONS, type AttendanceLiveLockDoc, type AttendanceStatus, type MemberDoc } from "./shared/types";

/**
 * MODÜL 3 — DERS KATILIM KONTROLÜ (Sunucu Tarafı)
 *
 * Akış:
 *  1. Admin `startLectureSession` ile dersi başlatır → oturum `live` olur, HMAC anahtarı
 *     yalnızca sunucuda (`attendance_secrets`, istemciye kapalı) üretilir.
 *  2. Projektör ekranı (yalnızca Admin) `getProjectorCode` ile 15 sn'lik güncel kodu alır.
 *     Kod / anahtar hiçbir zaman hekim istemcisine gönderilmez.
 *  3. Hekim, MFA ile açtığı oturumda kodu (QR okutarak ya da elle) `verifyRealTimeAttendance` ile gönderir.
 *     Cihaz bağlama yoktur (D23): yetkinin kaynağı oturum (`guards.ts`) ve projektör kodudur.
 *  4. Admin `endLectureSession` ile yoklamayı kapatır; süre dolunca zamanlayıcı (`closeExpiredLectures`)
 *     veya bir sonraki ders başlatma isteği kapatır.
 *  Her kayıt `attendance_logs` koleksiyonuna da yazılır → ders ve katılımcı bazlı dashboard.
 *
 * Yetki + istek doğrulaması: `defineCallable` (guards.ts + shared/schemas.ts).
 * F4.1: bütün yazımlar transaction içinde; sayaçlar durum geçişlerine göre (+1/−1); tek canlı ders kilidi
 * (`attendance_meta/live`); süre dolumu zamanlayıcısı; denetim kaydı aynı transaction'da.
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

const sessions = () => getFirestore().collection(COLLECTIONS.attendanceSessions);
const secrets = () => getFirestore().collection(COLLECTIONS.attendanceSecrets);
const liveLock = () => getFirestore().collection(COLLECTIONS.attendanceMeta).doc("live");

const NO_LIVE_SESSION = "Bu ders için aktif yoklama bulunmuyor.";

/**
 * Dersi kapatır (transaction içinde). D22: dersin başındaki beklenen hekimlerden kaydı olmayanlar için
 * `absent` kaydı ve düz log yazılır; böylece hekim kişisel geçmişinde katılmadığı dersi de görür ve raporlar
 * tek kaynaktan çalışır. Firestore kuralı gereği ÖNCE bütün okumalar (kayıtlar, eksik hekimlerin profilleri),
 * SONRA yazmalar yapılır; çağıran bu fonksiyondan önce yazma yapmamış olmalıdır.
 */
async function closeLecture(
  tx: Transaction,
  session: DocumentSnapshot,
  lockSessionId: string | undefined,
  closedBy: string,
  reason: "manual" | "expired"
): Promise<number> {
  const db = getFirestore();
  const data = session.data() ?? {};
  const expected: string[] = Array.isArray(data.expectedAttendees) ? data.expectedAttendees.map(String) : [];
  const recordsSnap = await tx.get(session.ref.collection(COLLECTIONS.attendanceRecords));
  const recorded = new Set(recordsSnap.docs.map((d) => d.id));
  const missing = expected.filter((uid) => !recorded.has(uid));
  const profiles = missing.length
    ? await tx.getAll(...missing.map((uid) => db.collection(COLLECTIONS.users).doc(uid)))
    : [];

  for (const profile of profiles) {
    const p = profile.data() ?? {};
    const record = {
      uid: profile.id,
      fullName: p.fullName ?? "",
      title: p.title ?? "",
      residencyYear: p.residencyYear ?? null,
      verifiedAt: null,
      markedAt: FieldValue.serverTimestamp(),
      method: "system_absent",
      status: "absent",
    };
    tx.set(session.ref.collection(COLLECTIONS.attendanceRecords).doc(profile.id), record);
    tx.set(db.collection(COLLECTIONS.attendanceLogs).doc(`${session.id}_${profile.id}`), {
      ...record,
      sessionId: session.id,
      sessionTitle: data.title,
      lecturer: data.lecturer,
      category: data.category,
      sessionStartedAt: data.startedAt,
    });
  }

  tx.update(session.ref, {
    status: "closed",
    closedAt: FieldValue.serverTimestamp(),
    closedBy,
    closeReason: reason,
    absentCount: profiles.length,
  });
  tx.delete(secrets().doc(session.id));
  if (lockSessionId === session.id) tx.delete(liveLock());
  return profiles.length;
}

/**
 * Admin: yeni ders yoklaması başlatır (F4.1).
 * Tek canlı ders kuralı `attendance_meta/live` kilidiyle TRANSACTION içinde uygulanır (eşzamanlı iki
 * başlatma isteğinden yalnızca biri geçer). Kilit süresi dolmuş bir derse aitse o ders aynı işlemde
 * kapatılır (zamanlayıcıyı beklemeden). Beklenen katılımcılar (o andaki etkin hekimler) derse yazılır.
 */
export const startLectureSession = defineCallable("startLectureSession", "admin", async (data, actor) => {
  const db = getFirestore();
  const sessionRef = sessions().doc();
  const now = Timestamp.now();
  const endsAt = Timestamp.fromMillis(now.toMillis() + data.durationMinutes * 60_000);

  await db.runTransaction(async (tx) => {
    const [lockSnap, members] = await Promise.all([
      tx.get(liveLock()),
      tx.get(db.collection(COLLECTIONS.users).where("status", "==", "active").where("role", "==", "user")),
    ]);
    const lock = lockSnap.data() as AttendanceLiveLockDoc<Timestamp> | undefined;
    if (lock) {
      if (lock.endsAt.toMillis() > now.toMillis()) {
        throw new HttpsError("failed-precondition", "Zaten devam eden bir ders yoklaması var. Önce onu bitirin.");
      }
      // Süresi dolmuş ama kapatılmamış ders: burada kapatılır.
      const stale = await tx.get(sessions().doc(lock.sessionId));
      if (stale.exists && stale.data()?.status === "live") {
        await closeLecture(tx, stale, lock.sessionId, "system", "expired");
        auditIn(tx, {
          actorUid: "system",
          actorEmail: "system",
          action: "ATTENDANCE_SESSION_EXPIRED",
          resourceType: "attendance",
          resourceId: lock.sessionId,
        });
      }
    }

    const expectedAttendees = members.docs.map((d) => d.id).sort();
    tx.set(sessionRef, {
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
      expectedAttendees,
      expectedCount: expectedAttendees.length,
    });
    tx.set(secrets().doc(sessionRef.id), {
      hmacSecret: crypto.randomBytes(32).toString("hex"),
      createdAt: now,
    });
    tx.set(liveLock(), { sessionId: sessionRef.id, endsAt });
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "ATTENDANCE_SESSION_STARTED",
      resourceType: "attendance",
      resourceId: sessionRef.id,
      metadata: { title: data.title, durationMinutes: data.durationMinutes, expectedCount: expectedAttendees.length },
    });
  });

  return { sessionId: sessionRef.id, endsAtMs: endsAt.toMillis() };
});

/** Admin: yoklamayı kapatır, HMAC anahtarını imha eder ve kilidi bırakır. */
export const endLectureSession = defineCallable("endLectureSession", "admin", async (data, actor) => {
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const [sessionSnap, lockSnap] = await Promise.all([tx.get(sessions().doc(data.sessionId)), tx.get(liveLock())]);
    if (!sessionSnap.exists) throw new HttpsError("not-found", "Yoklama oturumu bulunamadı.");
    if (sessionSnap.data()?.status !== "live") {
      throw new HttpsError("failed-precondition", "Bu ders yoklaması zaten kapatılmış.");
    }
    const absent = await closeLecture(tx, sessionSnap, lockSnap.data()?.sessionId, actor.uid, "manual");
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "ATTENDANCE_SESSION_CLOSED",
      resourceType: "attendance",
      resourceId: data.sessionId,
      metadata: { absentCount: absent },
    });
  });
  return { closed: true as const };
});

/** Admin (projektör): güncel kodu ve yenilenmeye kalan süreyi döndürür. Süresi dolan derste kod üretilmez. */
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
  if ((session.endsAt as Timestamp).toMillis() <= nowMs) {
    throw new HttpsError("failed-precondition", "Ders süresi doldu; yoklama kapandı.");
  }

  // Projektör ekranının ağı (tuzlu özet) gizli dokümanda tutulur; yalnızca değişince yazılır (S2).
  const ipHash = currentContext()?.ipHash;
  if (ipHash && secretSnap.data()!.projectorIpHash !== ipHash) {
    await secretSnap.ref.update({ projectorIpHash: ipHash });
  }

  const slot = Math.floor(nowMs / ATTENDANCE_SLOT_MS);
  return {
    code: computeSlotCode(String(secretSnap.data()!.hmacSecret), data.sessionId, slot),
    msUntilRotation: ATTENDANCE_SLOT_MS - (nowMs % ATTENDANCE_SLOT_MS),
    endsAtMs: (session.endsAt as Timestamp).toMillis(),
  };
});

type VerifyOutcome = { kind: "recorded"; alreadyRecorded: boolean } | { kind: "no-session" } | { kind: "invalid-code" };

/**
 * Hekim: projektör kodunu doğrular ve katılım kaydını yazar (F4.1, D23: tek TRANSACTION).
 * - Kimlik MFA'lı oturumdan gelir (`guards.ts`); cihaz imzası istenmez (D23).
 * - Aynı hekimin eşzamanlı iki isteğinden yalnızca biri kayıt yazar (transaction + `present` denetimi).
 * - Durum geçişleri: kayıt yok → katıldı (+1); mazeretli → katıldı (katılan +1, mazeretli −1); zaten katıldı → değişiklik yok.
 * - Reddedilen girişimlerin denetim kaydı transaction dışında yazılır (transaction'daki kayıt geri alınırdı).
 */
export const verifyRealTimeAttendance = defineCallable("verifyRealTimeAttendance", "member", async (data, actor) => {
  await enforceRateLimit(actor, "attendanceVerify");
  const db = getFirestore();
  const { uid, email: actorEmail } = actor;
  const sessionRef = sessions().doc(data.sessionId);
  const recordRef = sessionRef.collection(COLLECTIONS.attendanceRecords).doc(uid);
  const userRef = db.collection(COLLECTIONS.users).doc(uid);

  const outcome = await db.runTransaction<VerifyOutcome>(async (tx) => {
    const [sessionSnap, secretSnap, userSnap, recordSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(secrets().doc(data.sessionId)),
      tx.get(userRef),
      tx.get(recordRef),
    ]);
    const session = sessionSnap.data();
    if (
      !session ||
      session.status !== "live" ||
      !secretSnap.exists ||
      (session.endsAt as Timestamp).toMillis() < Date.now()
    ) {
      return { kind: "no-session" };
    }

    const profile = (userSnap.data() ?? {}) as Partial<MemberDoc<Timestamp>>;

    // Projektör kodu (bir önceki pencere ağ gecikmesi toleransı olarak kabul edilir).
    const secret = String(secretSnap.data()!.hmacSecret);
    const slot = Math.floor(Date.now() / ATTENDANCE_SLOT_MS);
    const given = Buffer.from(data.code);
    const valid = [slot, slot - 1].some((s) =>
      crypto.timingSafeEqual(Buffer.from(computeSlotCode(secret, data.sessionId, s)), given)
    );
    if (!valid) return { kind: "invalid-code" };

    const previous = recordSnap.data()?.status as AttendanceStatus | undefined;
    if (previous === "present") return { kind: "recorded", alreadyRecorded: true };

    const record = {
      uid,
      fullName: profile.fullName ?? actorEmail,
      title: profile.title ?? "",
      residencyYear: profile.residencyYear ?? null,
      verifiedAt: FieldValue.serverTimestamp(),
      // Yöntem yalnızca sunucunun doğruladığı şeyi yansıtır: MFA'lı oturum + projektör kodu (D23).
      // Kodun QR'dan mı elle mi geldiğini sunucu bilemez; bu yüzden ayrı bir değer yazılmaz.
      method: "code",
      status: "present",
    };
    tx.set(recordRef, record);
    tx.set(db.collection(COLLECTIONS.attendanceLogs).doc(`${data.sessionId}_${uid}`), {
      ...record,
      sessionId: data.sessionId,
      sessionTitle: session.title,
      lecturer: session.lecturer,
      category: session.category,
      sessionStartedAt: session.startedAt,
    });
    tx.update(sessionRef, {
      presentCount: FieldValue.increment(1),
      ...(previous === "excused" ? { excusedCount: FieldValue.increment(-1) } : {}),
    });
    // AUDIT S2: kod başka yerden iletilmiş olabilir mi? Projektör ekranıyla aynı ağdan gelmeyen katılım
    // işaretlenir (engellenmez: mobil veri kullanan dürüst hekim de farklı ağdadır; değerlendirme admin'de).
    const projectorIpHash = secretSnap.data()!.projectorIpHash as string | undefined;
    const ownIpHash = currentContext()?.ipHash;
    auditIn(tx, {
      actorUid: uid,
      actorEmail,
      action: "ATTENDANCE_VERIFIED",
      resourceType: "attendance",
      resourceId: data.sessionId,
      metadata: {
        ...(previous === "excused" ? { previousStatus: "excused" } : {}),
        ...(projectorIpHash && ownIpHash ? { sameNetworkAsProjector: projectorIpHash === ownIpHash } : {}),
      },
    });
    return { kind: "recorded", alreadyRecorded: false };
  });

  const rejected = async (action: string) =>
    writeAuditLog({
      actorUid: uid,
      actorEmail,
      action,
      resourceType: "attendance",
      resourceId: data.sessionId,
      severity: "WARN",
    });

  switch (outcome.kind) {
    case "recorded":
      return { verified: true as const, alreadyRecorded: outcome.alreadyRecorded };
    case "no-session":
      throw new HttpsError("failed-precondition", NO_LIVE_SESSION);
    case "invalid-code":
      await rejected("ATTENDANCE_EXPIRED_OR_INVALID_CODE");
      throw new HttpsError("deadline-exceeded", "Kod geçersiz veya süresi doldu. Projektördeki güncel kodu girin.");
  }
});

/**
 * Admin: hekimi derste mazeretli olarak işaretler (F4.1: TRANSACTION).
 * Kayıt yok → mazeretli (+1); zaten mazeretli → yalnızca not güncellenir (sayaç değişmez);
 * katılmış hekim mazeretliye çevrilmez (doğrulanmış katılım yanlışlıkla silinmesin).
 * Ders kapandıktan sonra da işaretlenebilir (mazeretler çoğunlukla sonradan bildirilir).
 */
export const markAttendanceExcused = defineCallable("markAttendanceExcused", "admin", async (data, actor) => {
  const db = getFirestore();
  const sessionRef = sessions().doc(data.sessionId);
  const recordRef = sessionRef.collection(COLLECTIONS.attendanceRecords).doc(data.targetUid);

  await db.runTransaction(async (tx) => {
    const [sessionSnap, userSnap, recordSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(db.collection(COLLECTIONS.users).doc(data.targetUid)),
      tx.get(recordRef),
    ]);
    if (!sessionSnap.exists || !userSnap.exists) throw new HttpsError("not-found", "Oturum veya hekim bulunamadı.");
    const previous = recordSnap.data()?.status as AttendanceStatus | undefined;
    if (previous === "present") {
      throw new HttpsError("failed-precondition", "Bu hekim derse katılmış görünüyor; mazeretli olarak işaretlenemez.");
    }
    const session = sessionSnap.data()!;
    const user = userSnap.data()!;

    const record = {
      uid: data.targetUid,
      fullName: user.fullName ?? "",
      title: user.title ?? "",
      residencyYear: user.residencyYear ?? null,
      verifiedAt: FieldValue.serverTimestamp(),
      method: "admin_excused",
      status: "excused",
      excuseNote: data.excuseNote,
      markedBy: actor.uid,
    };
    tx.set(recordRef, record);
    tx.set(db.collection(COLLECTIONS.attendanceLogs).doc(`${data.sessionId}_${data.targetUid}`), {
      ...record,
      sessionId: data.sessionId,
      sessionTitle: session.title,
      lecturer: session.lecturer,
      category: session.category,
      sessionStartedAt: session.startedAt,
    });
    if (previous !== "excused") {
      tx.update(sessionRef, {
        excusedCount: FieldValue.increment(1),
        // D22: kapanışta "katılmadı" yazılmış hekime sonradan mazeret girilirse katılmadı sayısı düşer.
        ...(previous === "absent" ? { absentCount: FieldValue.increment(-1) } : {}),
      });
    }
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: previous === "excused" ? "ATTENDANCE_EXCUSE_UPDATED" : "ATTENDANCE_MARKED_EXCUSED",
      resourceType: "attendance",
      resourceId: data.sessionId,
      metadata: { targetUid: data.targetUid, ...(previous ? { previousStatus: previous } : {}) },
    });
  });

  return { ok: true as const };
});

/**
 * Süresi dolmuş canlı dersleri kapatır, sırlarını siler ve kilidi bırakır (F4.1, AUDIT S4).
 * Zamanlayıcıdan (`scheduled.ts`) çağrılır; emülatör zamanlayıcıyı tetiklemediği için ayrı test edilir.
 * Her ders kendi transaction'ında kapatılır: aynı anda admin de kapatırsa çift kapatma/denetim kaydı olmaz.
 */
export async function closeExpiredLectures(now: Date = new Date()): Promise<string[]> {
  const db = getFirestore();
  const expired = await sessions().where("status", "==", "live").where("endsAt", "<=", Timestamp.fromDate(now)).get();
  const closed: string[] = [];
  for (const doc of expired.docs) {
    const done = await db.runTransaction(async (tx) => {
      const [snap, lockSnap] = await Promise.all([tx.get(doc.ref), tx.get(liveLock())]);
      if (snap.data()?.status !== "live") return false;
      await closeLecture(tx, snap, lockSnap.data()?.sessionId, "system", "expired");
      auditIn(tx, {
        actorUid: "system",
        actorEmail: "system",
        action: "ATTENDANCE_SESSION_EXPIRED",
        resourceType: "attendance",
        resourceId: doc.id,
      });
      return true;
    });
    if (done) closed.push(doc.id);
  }
  return closed;
}
