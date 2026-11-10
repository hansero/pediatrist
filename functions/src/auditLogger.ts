import { FieldValue, getFirestore, type Transaction, type WriteBatch } from "firebase-admin/firestore";
import type { AuditResourceType, AuditSeverity } from "./shared/constants";
import { COLLECTIONS } from "./shared/types";

export interface AuditLogInput {
  actorUid: string;
  actorEmail: string;
  action: string;
  resourceType: AuditResourceType;
  resourceId: string;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
}

function auditData(input: AuditLogInput) {
  return {
    ...input,
    severity: input.severity ?? "INFO",
    timestamp: FieldValue.serverTimestamp(),
  };
}

/**
 * Denetim kaydını ana yazımla AYNI batch / transaction içinde yazar (S10): işlem gerçekleşip kaydı
 * düşmemesi, ya da kaydı düşüp işlemin gerçekleşmemesi mümkün olmaz.
 */
export function auditIn(writer: WriteBatch | Transaction, input: AuditLogInput): void {
  const ref = getFirestore().collection(COLLECTIONS.auditLogs).doc();
  // WriteBatch ve Transaction'ın set imzaları uyumludur.
  (writer as WriteBatch).set(ref, auditData(input));
}

/**
 * Tek başına denetim kaydı (ör. reddedilen bir girişim: ana yazım yok).
 * İstemciler firestore.rules gereği bu koleksiyona yazamaz veya silemez.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await getFirestore().collection(COLLECTIONS.auditLogs).add(auditData(input));
}
