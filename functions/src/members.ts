import * as crypto from "crypto";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { auditIn, writeAuditLog } from "./auditLogger";
import { defineCallable } from "./callable";
import { enforceRateLimit } from "./rateLimit";
import { ATTENDANCE_CODE_ALPHABET, isResidentTitle, REGION, type MemberStatus, type Role } from "./shared/constants";
import { COLLECTIONS, type InvitationDoc, type MemberClaims, type MemberDoc } from "./shared/types";

/**
 * Üyelik (F2.3): kayıt, davetler, rol/durum yönetimi ve claim senkronu.
 *
 * Yetkinin kaynağı `users/{uid}` dokümanıdır (D3). Claim'ler önbellektir.
 * Yetki DÜŞÜŞÜNDE (aktiften çıkış veya admin'den düşme) ve cihaz sıfırlamada:
 *  - `tokensValidAfter` (epoch saniye) yazılır → kurallar ve guards.ts eski oturumları anında reddeder,
 *  - `revokeRefreshTokens` → oturum yenilenemez.
 */

const users = () => getFirestore().collection(COLLECTIONS.users);
const invitations = () => getFirestore().collection(COLLECTIONS.invitations);
const nowSeconds = () => Math.floor(Date.now() / 1000);

function normalizeRole(v: unknown): Role {
  return v === "admin" ? "admin" : "user";
}
function normalizeStatus(v: unknown): MemberStatus {
  return v === "active" || v === "suspended" ? v : "pending";
}

/** Yetki düşüşü mü? (aktiften çıkış veya admin'den düşme) */
export function isDowngrade(
  before: { role: unknown; status: unknown },
  after: { role: unknown; status: unknown }
): boolean {
  return (
    (before.status === "active" && after.status !== "active") || (before.role === "admin" && after.role !== "admin")
  );
}

function claimsOf(doc: Partial<MemberDoc<unknown>>): MemberClaims {
  return {
    role: normalizeRole(doc.role),
    status: normalizeStatus(doc.status),
    residencyYear: typeof doc.residencyYear === "number" ? doc.residencyYear : null,
  };
}

// =====================================================================================
// Claim senkronu (konsoldan yapılan değişiklikler dahil)
// =====================================================================================

/**
 * `users/{uid}` her yazıldığında claim'leri dokümanla eşitler. İlk admin'in konsoldan atanması da
 * bu yolla claim'e işlenir (DEPLOY.md). Callable'lar aynı işi kendileri de yapar; bu tetikleyici
 * dışarıdan yapılan değişikliklerin (konsol, Admin SDK) kaçmamasını sağlar.
 */
export const syncUserClaims = onDocumentWritten({ document: "users/{uid}", region: REGION }, async (event) => {
  const uid = event.params.uid;
  const before = event.data?.before.data() as MemberDoc<Timestamp> | undefined;
  const after = event.data?.after.data() as MemberDoc<Timestamp> | undefined;

  if (!after) {
    // Profil silindi: oturumları kapat, claim'leri temizle.
    if (before) {
      await getAuth()
        .revokeRefreshTokens(uid)
        .catch(() => undefined);
      await getAuth()
        .setCustomUserClaims(uid, null)
        .catch(() => undefined);
    }
    return;
  }

  const next = claimsOf(after);
  const prev = before ? claimsOf(before) : null;
  if (prev && prev.role === next.role && prev.status === next.status && prev.residencyYear === next.residencyYear) {
    return; // yalnızca başka alanlar değişti (ör. tokensValidAfter) → döngü yok
  }

  try {
    await getAuth().setCustomUserClaims(uid, next);
  } catch (err) {
    logger.warn("syncUserClaims: Auth kullanıcısı bulunamadı veya claim yazılamadı", { uid, err: String(err) });
    return;
  }

  const downgrade = prev !== null && isDowngrade(prev, next);
  if (downgrade) {
    await getAuth().revokeRefreshTokens(uid);
    // Callable (updateMemberAccess) aynı yazımda zaten iptal zamanı yazdıysa tekrar yazma.
    if (before?.tokensValidAfter === after.tokensValidAfter) {
      await event.data!.after.ref.set({ tokensValidAfter: nowSeconds() }, { merge: true });
    }
  }

  await writeAuditLog({
    actorUid: "system",
    actorEmail: "system",
    action: prev ? "MEMBER_CLAIMS_SYNCED" : "MEMBER_CLAIMS_INITIALIZED",
    resourceType: "auth",
    resourceId: uid,
    severity: downgrade ? "WARN" : "INFO",
    metadata: { ...next, ...(prev ? { previous: prev } : {}) },
  });
});

// =====================================================================================
// Admin: rol, durum, kıdem, cihaz sıfırlama
// =====================================================================================

export const updateMemberAccess = defineCallable("updateMemberAccess", "admin", async (data, actor) => {
  const changesRoleOrStatus = data.role !== undefined || data.status !== undefined;
  if (data.targetUid === actor.uid && changesRoleOrStatus) {
    throw new HttpsError(
      "failed-precondition",
      "Kendi rolünüzü veya üyelik durumunuzu değiştiremezsiniz. Bu işlemi başka bir Eğitim Sorumlusu yapmalıdır."
    );
  }
  try {
    await getAuth().getUser(data.targetUid);
  } catch {
    throw new HttpsError("not-found", "Kullanıcı bulunamadı.");
  }

  const db = getFirestore();
  const userRef = users().doc(data.targetUid);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError("not-found", "Üye profili bulunamadı.");
    const existing = snap.data() as MemberDoc<Timestamp>;
    // Kıdem yılı yalnızca asistanlar içindir (F3.5); uzman/öğretim üyesine yıl atanırsa yoklama uygunluğu (D24) ve
    // raporlar bozulur.
    if (data.residencyYear !== undefined && !isResidentTitle(String(existing.title ?? ""))) {
      throw new HttpsError("failed-precondition", "Kıdem yılı yalnızca asistanlar için değiştirilebilir.");
    }

    const role = data.role ?? normalizeRole(existing.role);
    const status = data.status ?? normalizeStatus(existing.status);
    const residencyYear = data.residencyYear ?? existing.residencyYear ?? null;

    // Son aktif admin korunur (sistem yönetilemez hale gelmesin).
    const wasActiveAdmin = existing.role === "admin" && existing.status === "active";
    const staysActiveAdmin = role === "admin" && status === "active";
    if (wasActiveAdmin && !staysActiveAdmin) {
      const activeAdmins = await tx.get(users().where("role", "==", "admin").where("status", "==", "active").limit(2));
      if (activeAdmins.size <= 1) {
        throw new HttpsError(
          "failed-precondition",
          "Son aktif Eğitim Sorumlusunun yetkisi düşürülemez veya üyeliği askıya alınamaz."
        );
      }
    }

    const downgrade = isDowngrade(existing, { role, status });
    const revoke = downgrade;
    const payload: Record<string, unknown> = {
      role,
      status,
      residencyYear,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    };
    if (status === "active" && existing.status !== "active") payload.approvedBy = actor.uid;
    if (revoke) payload.tokensValidAfter = nowSeconds();

    tx.set(userRef, payload, { merge: true });
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "MEMBER_ACCESS_UPDATED",
      resourceType: "admin",
      resourceId: data.targetUid,
      severity: revoke ? "WARN" : "INFO",
      metadata: {
        previous: { role: existing.role, status: existing.status, residencyYear: existing.residencyYear ?? null },
        role,
        status,
        residencyYear,
        sessionsRevoked: revoke,
      },
    });
    return { role, status, residencyYear, revoke };
  });

  // Claim önbelleği ve oturum iptali (syncUserClaims da yapar; burada gecikmesiz).
  await getAuth().setCustomUserClaims(data.targetUid, {
    role: result.role,
    status: result.status,
    residencyYear: result.residencyYear,
  });
  if (result.revoke) await getAuth().revokeRefreshTokens(data.targetUid);

  return {
    ok: true as const,
    targetUid: data.targetUid,
    role: result.role,
    status: result.status,
    residencyYear: result.residencyYear,
  };
});

// =====================================================================================
// Kayıt (D4: profil sunucuda yazılır)
// =====================================================================================

/**
 * Oturum açmış kullanıcının profilini oluşturur. İdempotent: profil varsa hiçbir şeyi değiştirmeden
 * mevcut durumu döndürür (yarım kalmış kayıt tekrar denenebilir). Rol/durum istemciden alınmaz:
 * geçerli davet → davetteki rol + `active`; davetsiz → `user` + `pending` (admin onayı bekler).
 */
export const completeRegistration = defineCallable("completeRegistration", "signedIn", async (data, me) => {
  const email = me.email;
  if (!email) {
    throw new HttpsError("failed-precondition", "Hesabınızda e-posta adresi bulunmuyor. E-posta ile kayıt olun.");
  }

  // Davet kodu tahminini keser (F9.2).
  await enforceRateLimit(me, "registration");

  // Silinmiş bir hesabın henüz süresi dolmamış oturum belirteciyle profil yeniden oluşturulamaz (F9.1):
  // aksi halde silinen üyenin adı ve e-postası başvuru listesine geri dönerdi.
  await getAuth()
    .getUser(me.uid)
    .catch(() => {
      throw new HttpsError(
        "unauthenticated",
        "Hesabınız bulunamadı. Yeniden kayıt olun ya da eğitim sorumlusuna başvurun."
      );
    });

  const db = getFirestore();
  const userRef = users().doc(me.uid);
  const out = await db.runTransaction(async (tx) => {
    const existing = await tx.get(userRef);
    if (existing.exists) {
      const d = existing.data() as MemberDoc<Timestamp>;
      return { ...claimsOf(d), alreadyRegistered: true };
    }

    let invite: { ref: FirebaseFirestore.DocumentReference; data: InvitationDoc<Timestamp> } | null = null;
    if (data.inviteCode) {
      const found = await tx.get(invitations().where("code", "==", data.inviteCode).limit(1));
      const doc = found.docs[0];
      const inv = doc?.data() as InvitationDoc<Timestamp> | undefined;
      const valid =
        inv &&
        !inv.used &&
        !inv.revoked &&
        inv.expiresAt.toMillis() > Date.now() &&
        String(inv.email).toLowerCase() === email;
      if (!doc || !valid) {
        throw new HttpsError(
          "invalid-argument",
          "Davet kodu geçersiz, süresi dolmuş veya bu e-posta adresine ait değil. Kodu kontrol edin ya da kodsuz başvurun."
        );
      }
      invite = { ref: doc.ref, data: inv };
    }

    const role: Role = invite ? normalizeRole(invite.data.intendedRole) : "user";
    const status: MemberStatus = invite ? "active" : "pending";
    // Kıdem yılı yalnızca asistanlar için (F3.5); davet bir yıl belirttiyse o geçerlidir.
    const residencyYear = isResidentTitle(data.title)
      ? (invite?.data.residencyYear ?? data.residencyYear ?? null)
      : null;

    tx.set(userRef, {
      uid: me.uid,
      title: data.title,
      fullName: data.fullName,
      email,
      residencyYear,
      role,
      status,
      inviteCode: data.inviteCode ?? null,
      consent: { version: data.consentVersion, acceptedAt: FieldValue.serverTimestamp() },
      createdAt: FieldValue.serverTimestamp(),
      ...(invite ? { approvedBy: invite.data.invitedBy } : {}),
    });
    if (invite) {
      tx.update(invite.ref, { used: true, usedBy: me.uid, usedAt: FieldValue.serverTimestamp() });
    }
    auditIn(tx, {
      actorUid: me.uid,
      actorEmail: email,
      action: "MEMBER_REGISTERED",
      resourceType: "auth",
      resourceId: me.uid,
      metadata: { role, status, viaInvitation: Boolean(invite) },
    });
    return { role, status, residencyYear, alreadyRegistered: false };
  });

  if (!out.alreadyRegistered) {
    await getAuth().setCustomUserClaims(me.uid, {
      role: out.role,
      status: out.status,
      residencyYear: out.residencyYear,
    });
  }
  return { status: out.status, role: out.role, alreadyRegistered: out.alreadyRegistered };
});

// =====================================================================================
// Davetler (admin)
// =====================================================================================

function newInvitationCode(): string {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (const b of bytes) out += ATTENDANCE_CODE_ALPHABET[b % ATTENDANCE_CODE_ALPHABET.length];
  return `PED-${out}`;
}

export const createInvitation = defineCallable("createInvitation", "admin", async (data, actor) => {
  const existingUser = await getAuth()
    .getUserByEmail(data.email)
    .catch(() => null);
  if (existingUser && (await users().doc(existingUser.uid).get()).exists) {
    throw new HttpsError("already-exists", "Bu e-posta adresiyle kayıtlı bir üye zaten var.");
  }

  const db = getFirestore();
  const ref = invitations().doc();
  const expiresAt = Timestamp.fromMillis(Date.now() + data.validForDays * 86_400_000);
  const code = await db.runTransaction(async (tx) => {
    let candidate = newInvitationCode();
    for (let i = 0; i < 3; i++) {
      const clash = await tx.get(invitations().where("code", "==", candidate).limit(1));
      if (clash.empty) break;
      candidate = newInvitationCode();
    }
    tx.set(ref, {
      code: candidate,
      email: data.email,
      intendedRole: data.intendedRole,
      residencyYear: data.residencyYear ?? null,
      invitedBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      used: false,
      revoked: false,
    });
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "INVITATION_CREATED",
      resourceType: "admin",
      resourceId: ref.id,
      metadata: { email: data.email, intendedRole: data.intendedRole, validForDays: data.validForDays },
    });
    return candidate;
  });

  return { invitationId: ref.id, code, expiresAtMs: expiresAt.toMillis() };
});

export const revokeInvitation = defineCallable("revokeInvitation", "admin", async (data, actor) => {
  const db = getFirestore();
  const ref = invitations().doc(data.invitationId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Davet bulunamadı.");
    const inv = snap.data() as InvitationDoc<Timestamp>;
    if (inv.used) throw new HttpsError("failed-precondition", "Kullanılmış bir davet iptal edilemez.");
    tx.update(ref, { revoked: true, revokedBy: actor.uid, revokedAt: FieldValue.serverTimestamp() });
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "INVITATION_REVOKED",
      resourceType: "admin",
      resourceId: data.invitationId,
    });
  });
  return { revoked: true as const };
});

// =====================================================================================
// Admin: iki aşamalı doğrulamayı sıfırla (F7.1)
// =====================================================================================

/**
 * Telefonunu kaybeden üyenin TOTP faktörleri Admin SDK ile silinir; oturumları iptal edilir (`tokensValidAfter`
 * + yenileme token'ları). Kendi faktörünü sıfırlamak için admin bu yolu kullanamaz (hesap ele geçirilmiş bir
 * admin oturumunun kendi MFA'sını kaldırması engellenir; kendi güvenlik sayfası yeniden giriş ister).
 */
export const resetMemberMfa = defineCallable("resetMemberMfa", "admin", async (data, actor) => {
  if (data.targetUid === actor.uid) {
    throw new HttpsError(
      "failed-precondition",
      "Kendi iki aşamalı doğrulamanızı buradan sıfırlayamazsınız. Hesap güvenliği sayfasını kullanın veya başka bir Eğitim Sorumlusuna başvurun."
    );
  }
  let factorsRemoved = 0;
  try {
    const user = await getAuth().getUser(data.targetUid);
    factorsRemoved = user.multiFactor?.enrolledFactors.length ?? 0;
  } catch {
    throw new HttpsError("not-found", "Kullanıcı bulunamadı.");
  }
  await getAuth().updateUser(data.targetUid, { multiFactor: { enrolledFactors: null } });
  const batch = getFirestore().batch();
  batch.set(users().doc(data.targetUid), { tokensValidAfter: nowSeconds() }, { merge: true });
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "MEMBER_MFA_RESET",
    resourceType: "admin",
    resourceId: data.targetUid,
    severity: "WARN",
    metadata: { factorsRemoved },
  });
  await batch.commit();
  await getAuth().revokeRefreshTokens(data.targetUid);
  return { reset: true as const, factorsRemoved };
});
