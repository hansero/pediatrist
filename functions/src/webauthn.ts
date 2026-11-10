import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp, getFirestore, type Transaction } from "firebase-admin/firestore";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { auditIn, writeAuditLog } from "./auditLogger";
import { defineCallable } from "./callable";
import { WEBAUTHN_ORIGINS, WEBAUTHN_RP_ID } from "./config";
import { WEBAUTHN_CHALLENGE_TTL_MS } from "./shared/constants";
import { COLLECTIONS, type MemberDoc, type WebAuthnChallengeDoc, type WebAuthnCredentialDoc } from "./shared/types";

/**
 * Yoklama cihazı: WebAuthn platform passkey'i (F4.2, D6, AUDIT S1).
 *
 * - Kayıt: `beginDeviceRegistration` → tarayıcı (Face ID / parmak izi / ekran kilidi) → `finishDeviceRegistration`.
 *   Hesap başına tek cihaz; değişiklik için admin "cihaz sıfırla" (`updateMemberAccess.resetBoundDevice`).
 * - Yoklama: `beginAttendanceAssertion(sessionId)` → tarayıcı imzası → `verifyRealTimeAttendance(..., assertion)`.
 *   İmza, sayaç ve kullanıcı doğrulaması (UV) sunucuda doğrulanır; ancak o zaman yöntem `qr+webauthn` yazılır.
 * - Challenge'lar tek kullanımlık ve 2 dk geçerli (`webauthn_challenges`, istemciye kapalı).
 * - Eski `localStorage` cihaz sırrı ve "aynı cihazdan ikinci hesap" sorgusu kaldırıldı: passkey hesaba özeldir.
 */

export interface RelyingParty {
  rpID: string;
  origins: string[];
}

/** RP ayarları (tek kaynak: functions parametreleri). Eksikse cihaz işlemleri güvenli biçimde reddedilir. */
export function relyingParty(): RelyingParty {
  const rpID = (process.env[WEBAUTHN_RP_ID.name] ?? "").trim();
  const origins = (process.env[WEBAUTHN_ORIGINS.name] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (!rpID || origins.length === 0) {
    throw new HttpsError("failed-precondition", "Cihaz doğrulaması bu ortamda yapılandırılmamış.");
  }
  return { rpID, origins };
}

const challengeRef = (uid: string, purpose: WebAuthnChallengeDoc<unknown>["purpose"]) =>
  getFirestore().collection(COLLECTIONS.webauthnChallenges).doc(`${uid}_${purpose}`);

function challengeExpiry() {
  return Timestamp.fromMillis(Date.now() + WEBAUTHN_CHALLENGE_TTL_MS);
}

/** Kütüphanenin seçenek tipi → sözleşmedeki gevşek nesne (yanıt şeması `challenge`'ı yine doğrular). */
const asOptions = (options: { challenge: string }) => options as unknown as { challenge: string; [k: string]: unknown };

const CHALLENGE_EXPIRED = "Cihaz doğrulamasının süresi doldu. Lütfen tekrar deneyin.";

/**
 * Challenge'ı transaction içinde okur ve SİLER (tek kullanımlık). Silme bir yazma olduğu için çağıran,
 * transaction'daki diğer bütün OKUMALARI bundan önce yapmalıdır (Firestore kuralı). Yoksa, süresi dolmuşsa veya başka bir
 * derse aitse `null` döner. Silme, çağıran transaction başarılı olursa kalıcıdır.
 */
export async function consumeChallenge(
  tx: Transaction,
  uid: string,
  purpose: WebAuthnChallengeDoc<unknown>["purpose"],
  sessionId?: string
): Promise<string | null> {
  const ref = challengeRef(uid, purpose);
  const snap = await tx.get(ref);
  const doc = snap.data() as WebAuthnChallengeDoc<Timestamp> | undefined;
  if (!doc) return null;
  tx.delete(ref);
  if (doc.expiresAt.toMillis() < Date.now()) return null;
  if (purpose === "attendance" && doc.sessionId !== sessionId) return null;
  return doc.challenge;
}

/** Kayıtlı credential ile yoklama imzasını doğrular. Başarılıysa yeni sayaç döner; değilse `null`. */
export async function verifyAttendanceAssertion(
  assertion: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: WebAuthnCredentialDoc<unknown>
): Promise<number | null> {
  const rp = relyingParty();
  if (assertion.id !== credential.credentialId) return null;
  try {
    const result = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: rp.origins,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, "base64url"),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransport[],
      },
    });
    return result.verified ? result.authenticationInfo.newCounter : null;
  } catch {
    // Geçersiz imza, yanlış köken/RP, UV yok, sayaç geri gitmiş (kopyalanmış doğrulayıcı) vb.
    return null;
  }
}

/** Hekim: bu cihazı yoklama cihazı olarak kaydetmeye başlar. */
export const beginDeviceRegistration = defineCallable("beginDeviceRegistration", "member", async (_data, actor) => {
  const rp = relyingParty();
  if (actor.profile.webauthn) {
    throw new HttpsError(
      "failed-precondition",
      "Bu hesaba zaten bir yoklama cihazı kayıtlı. Değişiklik için eğitim sorumlusuna başvurun."
    );
  }
  const options = await generateRegistrationOptions({
    rpName: "Pediatrist",
    rpID: rp.rpID,
    userID: new TextEncoder().encode(actor.uid),
    userName: actor.email,
    userDisplayName: `${actor.profile.title ?? ""} ${actor.profile.fullName ?? ""}`.trim() || actor.email,
    attestationType: "none",
    timeout: WEBAUTHN_CHALLENGE_TTL_MS,
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
    // ES256 ve RS256 (Windows Hello).
    supportedAlgorithmIDs: [-7, -257],
  });
  await challengeRef(actor.uid, "register").set({
    uid: actor.uid,
    purpose: "register",
    challenge: options.challenge,
    expiresAt: challengeExpiry(),
  } satisfies WebAuthnChallengeDoc<Timestamp>);
  return { options: asOptions(options) };
});

/** Hekim: tarayıcının ürettiği kaydı doğrular ve credential'ı hesaba bağlar. */
export const finishDeviceRegistration = defineCallable("finishDeviceRegistration", "member", async (data, actor) => {
  const rp = relyingParty();
  const db = getFirestore();
  const userRef = db.collection(COLLECTIONS.users).doc(actor.uid);

  const outcome = await db.runTransaction(async (tx) => {
    // Transaction'da bütün okumalar yazmalardan önce: önce üye, sonra challenge (okur + siler).
    const userSnap = await tx.get(userRef);
    const expectedChallenge = await consumeChallenge(tx, actor.uid, "register");
    if ((userSnap.data() as MemberDoc<Timestamp> | undefined)?.webauthn) return { kind: "already" as const };
    if (!expectedChallenge) return { kind: "expired" as const };

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: data.response as unknown as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: rp.origins,
        expectedRPID: rp.rpID,
        requireUserVerification: true,
        supportedAlgorithmIDs: [-7, -257],
      });
    } catch {
      return { kind: "invalid" as const };
    }
    if (!verification.verified || !verification.registrationInfo) return { kind: "invalid" as const };

    const { credential, credentialBackedUp } = verification.registrationInfo;
    const doc: WebAuthnCredentialDoc<FieldValue> = {
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? data.response.response.transports ?? [],
      backedUp: credentialBackedUp,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(userRef, { webauthn: doc }, { merge: true });
    auditIn(tx, {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "ATTENDANCE_DEVICE_REGISTERED",
      resourceType: "attendance",
      resourceId: actor.uid,
      metadata: { backedUp: credentialBackedUp },
    });
    return { kind: "ok" as const, backedUp: credentialBackedUp };
  });

  switch (outcome.kind) {
    case "ok":
      return { registered: true as const, backedUp: outcome.backedUp };
    case "already":
      throw new HttpsError(
        "failed-precondition",
        "Bu hesaba zaten bir yoklama cihazı kayıtlı. Değişiklik için eğitim sorumlusuna başvurun."
      );
    case "expired":
      throw new HttpsError("deadline-exceeded", CHALLENGE_EXPIRED);
    case "invalid":
      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        action: "ATTENDANCE_DEVICE_REGISTRATION_REJECTED",
        resourceType: "attendance",
        resourceId: actor.uid,
        severity: "WARN",
      });
      throw new HttpsError("permission-denied", "Cihaz kaydı doğrulanamadı. Lütfen tekrar deneyin.");
  }
});

/** Hekim: canlı derste yoklama vermeden önce cihaz imzası için challenge alır. */
export const beginAttendanceAssertion = defineCallable("beginAttendanceAssertion", "member", async (data, actor) => {
  const rp = relyingParty();
  const credential = actor.profile.webauthn;
  if (!credential) {
    throw new HttpsError(
      "failed-precondition",
      "Yoklama vermek için önce bu telefonu yoklama cihazı olarak kaydedin (Hesap › Yoklama cihazı)."
    );
  }
  const session = (await getFirestore().collection(COLLECTIONS.attendanceSessions).doc(data.sessionId).get()).data();
  if (!session || session.status !== "live" || (session.endsAt as Timestamp).toMillis() < Date.now()) {
    throw new HttpsError("failed-precondition", "Bu ders için aktif yoklama bulunmuyor.");
  }
  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    userVerification: "required",
    timeout: WEBAUTHN_CHALLENGE_TTL_MS,
    allowCredentials: [{ id: credential.credentialId, transports: credential.transports as AuthenticatorTransport[] }],
  });
  await challengeRef(actor.uid, "attendance").set({
    uid: actor.uid,
    purpose: "attendance",
    challenge: options.challenge,
    sessionId: data.sessionId,
    expiresAt: challengeExpiry(),
  } satisfies WebAuthnChallengeDoc<Timestamp>);
  return { options: asOptions(options) };
});
