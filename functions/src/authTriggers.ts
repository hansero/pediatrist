import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { writeAuditLog } from "./auditLogger";

/**
 * `/users/{uid}` dokümanı oluşturulduğunda veya Firebase Console üzerinden güncellendiğinde tetiklenir:
 * - Dokümandaki `role`, `status` ve `residencyYear` değerlerini Firebase Auth Custom Claims'e otomatik senkronize eder.
 * - Böylece konsoldan yapılan ilk Admin ataması da hiçbir terminal komutuna gerek kalmadan anında Custom Claims'e işlenir.
 */
export const onClinicMemberCreated = onDocumentWritten(
  { document: "users/{uid}", region: "europe-west1" },
  async (event) => {
    const uid = event.params.uid;
    const afterData = event.data?.after.data();
    if (!afterData) return;

    const beforeData = event.data?.before.data();
    const role = afterData.role === "admin" ? "admin" : "user";
    const status = afterData.status === "active" || afterData.status === "suspended" ? afterData.status : "pending";
    const residencyYear = Number(afterData.residencyYear ?? 1);

    if (
      beforeData &&
      beforeData.role === role &&
      beforeData.status === status &&
      Number(beforeData.residencyYear ?? 1) === residencyYear
    ) {
      return;
    }

    await getAuth().setCustomUserClaims(uid, {
      role,
      status,
      residencyYear,
    });

    if (!beforeData) {
      await writeAuditLog({
        actorUid: uid,
        actorEmail: String(afterData.email ?? "unknown"),
        action: "NEW_MEMBER_REGISTERED_WITH_PENDING_STATUS",
        resourceType: "auth",
        resourceId: uid,
        severity: "INFO",
        metadata: { residencyYear, role, status },
      });
    }
  }
);

/**
 * Admin tarafından üye onaylama, rol ('admin' | 'user'), kıdem yılı (1..4),
 * durum ('active' | 'pending' | 'suspended') atama ve telefon/cihaz eşleşmesini sıfırlama servisi.
 * Firebase Custom Claims güncellenir ve gerekirse mevcut oturum tokenları iptal edilir.
 */
export const updateMemberAccess = onCall({ enforceAppCheck: true, region: "europe-west1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Oturum açmanız gerekiyor.");
  }
  let isCallerAdmin = request.auth.token.role === "admin" && request.auth.token.status === "active";
  if (!isCallerAdmin) {
    const callerSnap = await getFirestore().collection("users").doc(request.auth.uid).get();
    const callerData = callerSnap.data() || {};
    isCallerAdmin = callerData.role === "admin" && callerData.status === "active";
  }
  if (!isCallerAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Bu işlem yalnızca aktif Eğitim Sorumlusu (Admin) yetkisiyle yapılabilir."
    );
  }

  const {
    targetUid,
    role: reqRole,
    status: reqStatus,
    residencyYear: reqYear,
    resetBoundDevice,
    resetDeviceBinding,
  } = request.data as {
    targetUid: string;
    role?: "admin" | "user";
    status?: "active" | "pending" | "suspended";
    residencyYear?: number;
    resetBoundDevice?: boolean;
    resetDeviceBinding?: boolean;
  };

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Hedef kullanıcı kimliği (targetUid) zorunludur.");
  }

  const userRef = getFirestore().collection("users").doc(targetUid);
  const existingSnap = await userRef.get();
  const existingData = existingSnap.data() || {};

  const role: "admin" | "user" = reqRole ?? (existingData.role === "admin" ? "admin" : "user");
  const status: "active" | "pending" | "suspended" =
    reqStatus ??
    (existingData.status === "active" || existingData.status === "suspended" ? existingData.status : "pending");
  const residencyYear = Number(reqYear ?? existingData.residencyYear ?? 1);
  const shouldResetDevice = Boolean(resetBoundDevice || resetDeviceBinding);

  if (!["admin", "user"].includes(role) || !["active", "pending", "suspended"].includes(status)) {
    throw new HttpsError("invalid-argument", "Geçersiz kullanıcı veya yetki parametreleri.");
  }

  // 1. Firebase Auth Custom Claims Güncellemesi
  await getAuth().setCustomUserClaims(targetUid, {
    role,
    status,
    residencyYear,
  });

  // 2. Askıya alma veya cihaz sıfırlamada aktif oturumları anında düşür (Zero-Trust)
  if (status !== "active" || shouldResetDevice) {
    await getAuth().revokeRefreshTokens(targetUid);
  }

  // 3. Firestore Kullanıcı Dokümanı Güncellemesi
  const updatePayload: Record<string, unknown> = {
    role,
    status,
    residencyYear,
    updatedAt: FieldValue.serverTimestamp(),
    approvedBy: request.auth.uid,
  };

  if (shouldResetDevice) {
    updatePayload.boundDeviceHash = null;
    updatePayload.hasBoundDevice = false;
    updatePayload.webAuthnCredentialId = null;
  }

  await userRef.set(updatePayload, { merge: true });

  // 4. Denetim Kaydı (Audit Log)
  await writeAuditLog({
    actorUid: request.auth.uid,
    actorEmail: request.auth.token.email ?? "unknown",
    action: shouldResetDevice ? "MEMBER_DEVICE_RESET" : "MEMBER_ACCESS_UPDATED",
    resourceType: "admin",
    resourceId: targetUid,
    severity: status === "suspended" || shouldResetDevice ? "WARN" : "INFO",
    metadata: { role, status, residencyYear, resetBoundDevice: shouldResetDevice },
  });

  return { ok: true, targetUid, role, status, residencyYear };
});
