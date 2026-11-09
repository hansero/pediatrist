import { FieldValue, getFirestore } from "firebase-admin/firestore";

export interface AuditLogInput {
  actorUid: string;
  actorEmail: string;
  action: string;
  resourceType: "auth" | "materials" | "calculators" | "attendance" | "quizzes" | "admin";
  resourceId: string;
  ipHash?: string;
  userAgent?: string;
  severity?: "INFO" | "WARN" | "CRITICAL";
  metadata?: Record<string, unknown>;
}

/**
 * Değiştirilemez Siber Güvenlik Denetim Kaydı (Immutable Audit Log) Yazar.
 * İstemciler firestore.rules gereği bu koleksiyona yazamaz veya silemez.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const db = getFirestore();
  await db.collection("audit_logs").add({
    ...input,
    severity: input.severity ?? "INFO",
    timestamp: FieldValue.serverTimestamp(),
  });
}
