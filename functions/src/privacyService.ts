import { HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { auditIn } from "./auditLogger";
import { defineCallable } from "./callable";
import { requireSelfOrAdmin } from "./guards";
import { enforceRateLimit } from "./rateLimit";
import { KVKK_NOTICE_VERSION } from "./shared/consent";
import { DELETED_MEMBER_NAME } from "./shared/constants";
import {
  COLLECTIONS,
  type AttendanceLogDoc,
  type AuditLogDoc,
  type InvitationDoc,
  type MaterialProgressDoc,
  type MemberDoc,
  type QuizAttemptDoc,
} from "./shared/types";

/**
 * KVKK işlemleri (F9.1): aydınlatma metni onayı, üye silme ve kişisel veri dökümü.
 *
 * Silmede ilke: kişiyi tanımlayan veriler (giriş hesabı, profil, cihaz bağı, adlar, mazeret notları, davet
 * e-postası) silinir; eğitim istatistikleri (sınav puanı, yoklama durumu) kimliksiz kalır. Denetim kayıtları
 * güvenlik kaydı olarak saklama süresi boyunca tutulur (F9.2: TTL) ve silme işleminin kendisi de kaydedilir.
 */

const iso = (v: unknown): string | null => (v instanceof Timestamp ? v.toDate().toISOString() : null);

/** Dökümdeki liste başına üst sınır (yanıt boyutu); aşılırsa `truncated` bildirilir. */
const EXPORT_LIMIT = 2000;

// =====================================================================================
// Aydınlatma metni onayı
// =====================================================================================

export const acceptConsent = defineCallable("acceptConsent", "member", async (data, actor) => {
  const db = getFirestore();
  const batch = db.batch();
  batch.update(db.collection(COLLECTIONS.users).doc(actor.uid), {
    consent: { version: data.consentVersion, acceptedAt: FieldValue.serverTimestamp() },
  });
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "MEMBER_CONSENT_ACCEPTED",
    resourceType: "auth",
    resourceId: actor.uid,
    metadata: { version: data.consentVersion, previousVersion: actor.profile.consent?.version ?? null },
  });
  await batch.commit();
  return { accepted: true as const, version: data.consentVersion };
});

// =====================================================================================
// Üye silme
// =====================================================================================

export const deleteMember = defineCallable("deleteMember", "admin", async (data, actor) => {
  const uid = data.targetUid;
  if (uid === actor.uid) {
    // Çağıran etkin admin olduğundan, kendini silememesi en az bir adminin kalmasını da güvenceye alır.
    throw new HttpsError(
      "failed-precondition",
      "Kendi hesabınızı buradan silemezsiniz. Başka bir eğitim sorumlusundan isteyin."
    );
  }

  const db = getFirestore();
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const profileSnap = await userRef.get();
  if (!profileSnap.exists) throw new HttpsError("not-found", "Üye bulunamadı; daha önce silinmiş olabilir.");
  const profile = profileSnap.data() as MemberDoc<Timestamp>;
  const email = String(profile.email ?? "").toLowerCase();

  const [attempts, logs, materials, usedInvites, emailInvites, authoredMaterials, authoredNotes] = await Promise.all([
    db.collection(COLLECTIONS.quizAttempts).where("uid", "==", uid).get(),
    db.collection(COLLECTIONS.attendanceLogs).where("uid", "==", uid).get(),
    db.collection(COLLECTIONS.materials).select().get(),
    db.collection(COLLECTIONS.invitations).where("usedBy", "==", uid).get(),
    email ? db.collection(COLLECTIONS.invitations).where("email", "==", email).get() : Promise.resolve(null),
    db.collection(COLLECTIONS.materials).where("uploadedBy", "==", uid).select().get(),
    db.collection(COLLECTIONS.calculatorsConfig).where("updatedBy", "==", uid).select().get(),
  ]);

  // Var olan kayıtlar (olmayan dokümana `update` yazılmaz): ders kayıtları ve materyal ilerlemeleri.
  const recordRefs = logs.docs.map((d) =>
    db
      .collection(COLLECTIONS.attendanceSessions)
      .doc(String((d.data() as AttendanceLogDoc<Timestamp>).sessionId))
      .collection(COLLECTIONS.attendanceRecords)
      .doc(uid)
  );
  const progressRefs = materials.docs.map((m) => m.ref.collection(COLLECTIONS.materialProgress).doc(uid));
  const existing = async (refs: FirebaseFirestore.DocumentReference[]) =>
    refs.length ? (await db.getAll(...refs)).filter((s) => s.exists).map((s) => s.ref) : [];
  const [records, progress] = await Promise.all([existing(recordRefs), existing(progressRefs)]);

  // 1) Kayıtlar addan arındırılır (yinelenebilir: yarıda kalırsa profil durduğu için işlem tekrar çalıştırılır).
  const writer = db.bulkWriter();
  const attendanceTombstone = { fullName: DELETED_MEMBER_NAME, title: "", excuseNote: FieldValue.delete() };
  for (const a of attempts.docs) {
    void writer.update(a.ref, { doctorName: DELETED_MEMBER_NAME });
    const quizId = String((a.data() as QuizAttemptDoc<Timestamp>).quizId);
    void writer.delete(db.collection(COLLECTIONS.quizAttemptDrafts).doc(`${quizId}_${uid}`));
  }
  for (const l of logs.docs) void writer.update(l.ref, attendanceTombstone);
  for (const r of records) void writer.update(r, attendanceTombstone);
  for (const p of progress) void writer.delete(p);
  for (const m of authoredMaterials.docs) void writer.update(m.ref, { uploadedByName: DELETED_MEMBER_NAME });
  for (const n of authoredNotes.docs) void writer.update(n.ref, { updatedByName: DELETED_MEMBER_NAME });
  // Davetler: kullandığı davetteki e-posta silinir; aynı adrese gönderilmiş kullanılmamış davetler kaldırılır.
  for (const i of usedInvites.docs) void writer.update(i.ref, { email: DELETED_MEMBER_NAME });
  const unusedInvites = (emailInvites?.docs ?? []).filter((i) => !(i.data() as InvitationDoc<Timestamp>).used);
  for (const i of unusedInvites) void writer.delete(i.ref);
  await writer.close();

  // 2) Giriş hesabı (yoksa sorun değil: önceki yarım denemede silinmiş olabilir).
  await getAuth()
    .deleteUser(uid)
    .catch((err: { code?: string }) => {
      if (err?.code !== "auth/user-not-found") throw err;
    });

  // 3) Profil + denetim kaydı (kimlik bilgisi içermez).
  const anonymized = {
    quizAttempts: attempts.size,
    attendanceRecords: logs.size,
    authoredItems: authoredMaterials.size + authoredNotes.size,
  };
  const removed = { materialProgress: progress.length, invitations: unusedInvites.length };
  const batch = db.batch();
  batch.delete(userRef);
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "MEMBER_DELETED",
    resourceType: "admin",
    resourceId: uid,
    severity: "CRITICAL",
    metadata: { role: profile.role, status: profile.status, ...anonymized, ...removed },
  });
  await batch.commit();

  return { deleted: true as const, anonymized, removed };
});

// =====================================================================================
// Kişisel veri dökümü
// =====================================================================================

export const exportMemberData = defineCallable("exportMemberData", "member", async (data, actor) => {
  requireSelfOrAdmin(actor, data.targetUid);
  await enforceRateLimit(actor, "dataExport");
  const uid = data.targetUid;
  const db = getFirestore();

  const profileSnap = uid === actor.uid ? null : await db.collection(COLLECTIONS.users).doc(uid).get();
  const profile = profileSnap ? (profileSnap.data() as MemberDoc<Timestamp> | undefined) : actor.profile;
  if (!profile) throw new HttpsError("not-found", "Üye bulunamadı.");

  const [attempts, logs, materials, activity] = await Promise.all([
    db
      .collection(COLLECTIONS.quizAttempts)
      .where("uid", "==", uid)
      .limit(EXPORT_LIMIT + 1)
      .get(),
    db
      .collection(COLLECTIONS.attendanceLogs)
      .where("uid", "==", uid)
      .limit(EXPORT_LIMIT + 1)
      .get(),
    db.collection(COLLECTIONS.materials).select("title").get(),
    db
      .collection(COLLECTIONS.auditLogs)
      .where("actorUid", "==", uid)
      .limit(EXPORT_LIMIT + 1)
      .get(),
  ]);
  const progressSnaps = materials.size
    ? await db.getAll(...materials.docs.map((m) => m.ref.collection(COLLECTIONS.materialProgress).doc(uid)))
    : [];
  const titles = new Map(materials.docs.map((m) => [m.id, String(m.get("title") ?? "")]));
  const byTime = (a: string | null, b: string | null) => (b ?? "").localeCompare(a ?? "");

  const batch = db.batch();
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "MEMBER_DATA_EXPORTED",
    resourceType: "admin",
    resourceId: uid,
    metadata: { self: uid === actor.uid },
  });
  await batch.commit();

  return {
    exportedAt: new Date().toISOString(),
    noticeVersion: KVKK_NOTICE_VERSION,
    profile: {
      uid,
      title: String(profile.title ?? ""),
      fullName: String(profile.fullName ?? ""),
      email: String(profile.email ?? ""),
      residencyYear: typeof profile.residencyYear === "number" ? profile.residencyYear : null,
      role: profile.role === "admin" ? ("admin" as const) : ("user" as const),
      status: profile.status === "active" || profile.status === "suspended" ? profile.status : ("pending" as const),
      createdAt: iso(profile.createdAt),
      consent: profile.consent
        ? { version: String(profile.consent.version), acceptedAt: iso(profile.consent.acceptedAt) }
        : null,
    },
    quizAttempts: attempts.docs
      .slice(0, EXPORT_LIMIT)
      .map((d) => d.data() as QuizAttemptDoc<Timestamp>)
      .map((a) => ({
        quizTitle: String(a.quizTitle ?? ""),
        status: String(a.status),
        startedAt: iso(a.startedAt),
        submittedAt: iso(a.submittedAt),
        score: typeof a.score === "number" ? a.score : null,
        correctCount: typeof a.correctCount === "number" ? a.correctCount : null,
        totalQuestions: typeof a.totalQuestions === "number" ? a.totalQuestions : null,
        lateSubmission: a.lateSubmission === true,
        autoSubmitted: a.autoSubmitted === true,
        tabSwitchCount: typeof a.tabSwitchCount === "number" ? a.tabSwitchCount : null,
        // Yalnızca üyenin kendi yanıtı ve sonucu; cevap anahtarı ve açıklama dökülmez (kural 5).
        answers: (a.results ?? [])
          .slice()
          .sort((x, y) => x.orderIndex - y.orderIndex)
          .map((r) => ({
            question: r.orderIndex,
            response: r.userResponse ?? [],
            isCorrect: r.isCorrect === true,
          })),
      }))
      .sort((a, b) => byTime(a.startedAt, b.startedAt)),
    attendance: logs.docs
      .slice(0, EXPORT_LIMIT)
      .map((d) => d.data() as AttendanceLogDoc<Timestamp>)
      .map((l) => ({
        lectureTitle: String(l.sessionTitle ?? ""),
        lecturer: String(l.lecturer ?? ""),
        lectureStartedAt: iso(l.sessionStartedAt),
        status: String(l.status),
        method: String(l.method),
        verifiedAt: iso(l.verifiedAt),
        excuseNote: typeof l.excuseNote === "string" && l.excuseNote ? l.excuseNote : null,
      }))
      .sort((a, b) => byTime(a.lectureStartedAt, b.lectureStartedAt)),
    materialProgress: progressSnaps
      .filter((s) => s.exists)
      .map((s) => {
        const p = s.data() as MaterialProgressDoc<Timestamp>;
        return {
          materialTitle: titles.get(s.ref.parent.parent!.id) ?? "",
          secondsSpent: Number(p.secondsSpent ?? 0),
          lastPage: Number(p.lastPage ?? 0),
          completed: p.completed === true,
          updatedAt: iso(p.updatedAt),
        };
      }),
    activity: activity.docs
      .slice(0, EXPORT_LIMIT)
      .map((d) => d.data() as AuditLogDoc<Timestamp>)
      .map((l) => ({ action: String(l.action), at: iso(l.timestamp) }))
      .sort((a, b) => byTime(a.at, b.at)),
    truncated: [attempts, logs, activity].some((s) => s.size > EXPORT_LIMIT),
  };
});
