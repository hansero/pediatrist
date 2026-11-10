import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { writeAuditLog } from "./auditLogger";
import { defineCallable } from "./callable";
import { REGION, type MemberStatus, type Role } from "./shared/constants";
import { COLLECTIONS } from "./shared/types";

/**
 * `/users/{uid}` dokümanı oluşturulduğunda veya Firebase Console üzerinden güncellendiğinde tetiklenir:
 * - Dokümandaki `role`, `status` ve `residencyYear` değerlerini Firebase Auth Custom Claims'e otomatik senkronize eder.
 * - Böylece konsoldan yapılan ilk Admin ataması da hiçbir terminal komutuna gerek kalmadan anında Custom Claims'e işlenir.
 */
export const onClinicMemberCreated = onDocumentWritten({ document: "users/{uid}", region: REGION }, async (event) => {
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
});

/**
 * Admin tarafından üye onaylama, rol ('admin' | 'user'), kıdem yılı (1..4),
 * durum ('active' | 'pending' | 'suspended') atama ve cihaz eşleşmesini sıfırlama.
 * Yetki ve istek doğrulaması `defineCallable` içinde yapılır (guards.ts + shared/schemas.ts).
 * Son admin ve kendini düşürme korumaları F2.3'te eklenir.
 */
export const updateMemberAccess = defineCallable("updateMemberAccess", "admin", async (data, actor) => {
  const userRef = getFirestore().collection(COLLECTIONS.users).doc(data.targetUid);
  const existing = (await userRef.get()).data() ?? {};

  const role: Role = data.role ?? (existing.role === "admin" ? "admin" : "user");
  const status: MemberStatus =
    data.status ?? (existing.status === "active" || existing.status === "suspended" ? existing.status : "pending");
  const residencyYear = Number(data.residencyYear ?? existing.residencyYear ?? 1);
  const shouldResetDevice = Boolean(data.resetBoundDevice);

  // 1. Custom claims (önbellek; yetkinin kaynağı doküman)
  await getAuth().setCustomUserClaims(data.targetUid, { role, status, residencyYear });

  // 2. Askıya alma veya cihaz sıfırlamada aktif oturumları düşür
  if (status !== "active" || shouldResetDevice) {
    await getAuth().revokeRefreshTokens(data.targetUid);
  }

  // 3. Profil
  const updatePayload: Record<string, unknown> = {
    role,
    status,
    residencyYear,
    updatedAt: FieldValue.serverTimestamp(),
    approvedBy: actor.uid,
  };
  if (shouldResetDevice) {
    updatePayload.boundDeviceHash = null;
    updatePayload.hasBoundDevice = false;
    updatePayload.webAuthnCredentialId = null;
  }
  await userRef.set(updatePayload, { merge: true });

  // 4. Denetim kaydı
  await writeAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: shouldResetDevice ? "MEMBER_DEVICE_RESET" : "MEMBER_ACCESS_UPDATED",
    resourceType: "admin",
    resourceId: data.targetUid,
    severity: status === "suspended" || shouldResetDevice ? "WARN" : "INFO",
    metadata: { role, status, residencyYear, resetBoundDevice: shouldResetDevice },
  });

  return { ok: true as const, targetUid: data.targetUid, role, status, residencyYear };
});
