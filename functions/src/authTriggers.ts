import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { writeAuditLog } from "./auditLogger";

/**
 * Yeni kayıt olan hekim `/users/{uid}` dokümanını oluşturduğunda tetiklenir:
 * - Varsayılan Custom Claims (`role: "user"`, `status: "pending"`) atanır.
 * - Değiştirilemez `audit_logs` koleksiyonuna yeni üyelik başvurusu kaydedilir.
 */
export const onClinicMemberCreated = onDocumentCreated(
  { document: "users/{uid}", region: "europe-west1" },
  async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data() || {};
    const residencyYear = Number(data.residencyYear ?? 1);

    await admin.auth().setCustomUserClaims(uid, {
      role: "user",
      status: "pending",
      residencyYear,
    });

    await writeAuditLog({
      actorUid: uid,
      actorEmail: String(data.email ?? "unknown"),
      action: "NEW_MEMBER_REGISTERED_WITH_PENDING_STATUS",
      resourceType: "auth",
      resourceId: uid,
      severity: "INFO",
      metadata: { residencyYear },
    });
  }
);

/**
 * Admin tarafından üye onaylama, rol ('admin' | 'user'), kıdem yılı (1..4),
 * durum ('active' | 'pending' | 'suspended') atama ve telefon/cihaz eşleşmesini sıfırlama servisi.
 * Firebase Custom Claims güncellenir ve gerekirse mevcut oturum tokenları iptal edilir.
 */
export const updateMemberAccess = onCall(
  { enforceAppCheck: true, region: "europe-west1" },
  async (request) => {
    if (!request.auth || request.auth.token.role !== "admin" || request.auth.token.status !== "active") {
      throw new HttpsError("permission-denied", "Bu işlem yalnızca aktif Eğitim Sorumlusu (Admin) yetkisiyle yapılabilir.");
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

    const userRef = admin.firestore().collection("users").doc(targetUid);
    const existingSnap = await userRef.get();
    const existingData = existingSnap.data() || {};

    const role: "admin" | "user" = reqRole ?? (existingData.role === "admin" ? "admin" : "user");
    const status: "active" | "pending" | "suspended" =
      reqStatus ??
      (existingData.status === "active" || existingData.status === "suspended"
        ? existingData.status
        : "pending");
    const residencyYear = Number(reqYear ?? existingData.residencyYear ?? 1);
    const shouldResetDevice = Boolean(resetBoundDevice || resetDeviceBinding);

    if (!["admin", "user"].includes(role) || !["active", "pending", "suspended"].includes(status)) {
      throw new HttpsError("invalid-argument", "Geçersiz kullanıcı veya yetki parametreleri.");
    }

    // 1. Firebase Auth Custom Claims Güncellemesi
    await admin.auth().setCustomUserClaims(targetUid, {
      role,
      status,
      residencyYear,
    });

    // 2. Askıya alma veya cihaz sıfırlamada aktif oturumları anında düşür (Zero-Trust)
    if (status !== "active" || shouldResetDevice) {
      await admin.auth().revokeRefreshTokens(targetUid);
    }

    // 3. Firestore Kullanıcı Dokümanı Güncellemesi
    const updatePayload: Record<string, unknown> = {
      role,
      status,
      residencyYear,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
  }
);
