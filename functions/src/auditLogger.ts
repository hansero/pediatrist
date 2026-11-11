import { FieldValue, Timestamp, getFirestore, type Transaction, type WriteBatch } from "firebase-admin/firestore";
import { AUDIT_RETENTION_DAYS } from "./config";
import { currentContext } from "./requestContext";
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

const DAY_MS = 86_400_000;
const DEFAULT_RETENTION_DAYS = 730;
const MIN_RETENTION_DAYS = 30;

/** Saklama süresi (gün). Geçersiz ya da çok kısa değer varsayılana döner: yanlış ayar kayıtları erken silmesin. */
export function auditRetentionDays(raw: string | undefined = process.env[AUDIT_RETENTION_DAYS.name]): number {
  const days = Number(raw);
  return Number.isInteger(days) && days >= MIN_RETENTION_DAYS ? days : DEFAULT_RETENTION_DAYS;
}

function auditData(input: AuditLogInput) {
  const context = currentContext();
  return {
    ...input,
    severity: input.severity ?? "INFO",
    timestamp: FieldValue.serverTimestamp(),
    // Saklama süresi sonu: Firestore TTL politikası bu alana göre siler (F9.2).
    expireAt: Timestamp.fromMillis(Date.now() + auditRetentionDays() * DAY_MS),
    // İsteğin geldiği ağın tuzlu özeti ve tarayıcı bilgisi (callable isteklerinde; ham IP yazılmaz).
    ...(context?.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context?.userAgent ? { userAgent: context.userAgent } : {}),
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
