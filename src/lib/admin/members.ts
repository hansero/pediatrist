"use client";

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import type { AuditResourceType, AuditSeverity, MemberStatus, Role } from "@shared/constants";
import { COLLECTIONS } from "@shared/types";
import { useCapped, useFirestoreSnapshot, type CappedState, type LiveState } from "@/hooks/useFirestoreSnapshot";
import { notConfiguredError } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";

/**
 * Admin paneli verisi (F7.1, F7.2). Kurallar: `users`, `invitations`, `audit_logs` yalnızca admin'e okunur;
 * hepsine yazma yalnızca callable'larla (`updateMemberAccess`, `resetMemberMfa`, `createInvitation`,
 * `revokeInvitation`); denetim kaydını yalnızca sunucu yazar (istemcide üretilen kayıt yok, AUDIT C10).
 */

const ms = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === "function" ? (v as Timestamp).toMillis() : null;

function db() {
  const firestore = initPediatristFirebase()?.db;
  if (!firestore) throw notConfiguredError();
  return firestore;
}

// --- Üyeler --------------------------------------------------------------------------------------

export interface MemberRow {
  uid: string;
  title: string;
  fullName: string;
  email: string;
  residencyYear: number | null;
  role: Role;
  status: MemberStatus;
  createdAtMs: number | null;
  hasDevice: boolean;
}

export const memberName = (m: Pick<MemberRow, "title" | "fullName">) => `${m.title} ${m.fullName}`.trim();

export function toMemberRow(uid: string, d: DocumentData): MemberRow {
  return {
    uid,
    title: String(d.title ?? ""),
    fullName: String(d.fullName ?? ""),
    email: String(d.email ?? ""),
    residencyYear: typeof d.residencyYear === "number" ? d.residencyYear : null,
    role: d.role === "admin" ? "admin" : "user",
    status: d.status === "active" || d.status === "suspended" ? d.status : "pending",
    createdAtMs: ms(d.createdAt),
    hasDevice: Boolean(d.webauthn?.credentialId),
  };
}

export const STATUS_LABEL: Record<MemberStatus, string> = {
  pending: "Onay bekliyor",
  active: "Etkin",
  suspended: "Askıda",
};
export const ROLE_LABEL: Record<Role, string> = { admin: "Eğitim sorumlusu", user: "Hekim" };

export const MEMBER_LIST_LIMIT = 1000;

/** Bütün üyeler (canlı). Sıralama istemcide: önce onay bekleyenler, sonra ada göre. */
export function useMembers(): CappedState<MemberRow> {
  const state = useFirestoreSnapshot<MemberRow[]>((onData, onError) => {
    const firestore = initPediatristFirebase()?.db;
    if (!firestore) return null;
    return onSnapshot(
      query(collection(firestore, COLLECTIONS.users), limit(MEMBER_LIST_LIMIT + 1)),
      (snap) => onData(sortMembers(snap.docs.map((d) => toMemberRow(d.id, d.data())))),
      onError
    );
  }, []);
  return useCapped(state, MEMBER_LIST_LIMIT);
}

const STATUS_ORDER: Record<MemberStatus, number> = { pending: 0, active: 1, suspended: 2 };

export function sortMembers(rows: MemberRow[]): MemberRow[] {
  return [...rows].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || memberName(a).localeCompare(memberName(b), "tr")
  );
}

export function filterMembers(
  rows: readonly MemberRow[],
  { status, search }: { status: MemberStatus | "all"; search: string }
) {
  const term = search.trim().toLocaleLowerCase("tr");
  return rows.filter(
    (m) =>
      (status === "all" || m.status === status) &&
      (!term || `${memberName(m)} ${m.email}`.toLocaleLowerCase("tr").includes(term))
  );
}

export type MemberAction =
  "approve" | "reactivate" | "suspend" | "makeAdmin" | "removeAdmin" | "resetDevice" | "resetMfa" | "changeYear";

/**
 * Bir üyede yapılabilecek işlemler. "Onayla" (bekleyen) ve "Yeniden etkinleştir" (askıdaki) ayrı eylemlerdir.
 * Kendi satırında rol/durum işlemleri ve kendi MFA sıfırlaması yoktur (sunucu da reddeder).
 */
export function availableActions(m: MemberRow, selfUid: string): MemberAction[] {
  const self = m.uid === selfUid;
  const actions: MemberAction[] = [];
  if (!self) {
    if (m.status === "pending") actions.push("approve");
    if (m.status === "suspended") actions.push("reactivate");
    if (m.status !== "suspended") actions.push("suspend");
    if (m.status === "active") actions.push(m.role === "admin" ? "removeAdmin" : "makeAdmin");
  }
  if (m.hasDevice) actions.push("resetDevice");
  if (!self) actions.push("resetMfa");
  if (m.role === "user") actions.push("changeYear");
  return actions;
}

// --- Davetler ------------------------------------------------------------------------------------

export type InvitationState = "valid" | "used" | "revoked" | "expired";
export const INVITATION_STATE_LABEL: Record<InvitationState, string> = {
  valid: "Geçerli",
  used: "Kullanıldı",
  revoked: "İptal edildi",
  expired: "Süresi doldu",
};

export interface InvitationRow {
  id: string;
  code: string;
  email: string;
  intendedRole: Role;
  residencyYear: number | null;
  createdAtMs: number | null;
  expiresAtMs: number | null;
  state: InvitationState;
}

export function toInvitationRow(id: string, d: DocumentData, nowMs = Date.now()): InvitationRow {
  const expiresAtMs = ms(d.expiresAt);
  const state: InvitationState = d.used
    ? "used"
    : d.revoked
      ? "revoked"
      : expiresAtMs !== null && expiresAtMs <= nowMs
        ? "expired"
        : "valid";
  return {
    id,
    code: String(d.code ?? ""),
    email: String(d.email ?? ""),
    intendedRole: d.intendedRole === "admin" ? "admin" : "user",
    residencyYear: typeof d.residencyYear === "number" ? d.residencyYear : null,
    createdAtMs: ms(d.createdAt),
    expiresAtMs,
    state,
  };
}

export function useInvitations(): LiveState<InvitationRow[]> {
  return useFirestoreSnapshot<InvitationRow[]>((onData, onError) => {
    const firestore = initPediatristFirebase()?.db;
    if (!firestore) return null;
    return onSnapshot(
      query(collection(firestore, COLLECTIONS.invitations), orderBy("createdAt", "desc"), limit(200)),
      (snap) => onData(snap.docs.map((d) => toInvitationRow(d.id, d.data()))),
      onError
    );
  }, []);
}

// --- Denetim kayıtları ----------------------------------------------------------------------------

export interface AuditRow {
  id: string;
  timestampMs: number | null;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  severity: AuditSeverity;
  metadata: Record<string, unknown>;
}

export function toAuditRow(id: string, d: DocumentData): AuditRow {
  return {
    id,
    timestampMs: ms(d.timestamp),
    actorEmail: String(d.actorEmail ?? ""),
    action: String(d.action ?? ""),
    resourceType: String(d.resourceType ?? ""),
    resourceId: String(d.resourceId ?? ""),
    severity: d.severity === "WARN" || d.severity === "CRITICAL" ? d.severity : "INFO",
    metadata: d.metadata && typeof d.metadata === "object" ? (d.metadata as Record<string, unknown>) : {},
  };
}

export const AUDIT_PAGE_SIZE = 50;

export interface AuditPage {
  rows: AuditRow[];
  cursor: QueryDocumentSnapshot | null;
}

/** Denetim kayıtları: yeniden eskiye, sayfalı; önem ve modül süzgeçleri (indeksler: firestore.indexes.json). */
export async function fetchAuditPage(
  filters: { severity: AuditSeverity | "all"; resourceType: AuditResourceType | "all" },
  after: QueryDocumentSnapshot | null = null
): Promise<AuditPage> {
  const constraints: QueryConstraint[] = [];
  if (filters.resourceType !== "all") constraints.push(where("resourceType", "==", filters.resourceType));
  if (filters.severity !== "all") constraints.push(where("severity", "==", filters.severity));
  constraints.push(orderBy("timestamp", "desc"));
  if (after) constraints.push(startAfter(after));
  constraints.push(limit(AUDIT_PAGE_SIZE));
  const snap = await getDocs(query(collection(db(), COLLECTIONS.auditLogs), ...constraints));
  return {
    rows: snap.docs.map((d) => toAuditRow(d.id, d.data())),
    cursor: snap.size === AUDIT_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
  };
}

/** Bilinen eylemlerin Türkçe adı; bilinmeyen kod olduğu gibi gösterilir (yeni eylem eklenince sessizce kaybolmaz). */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  MEMBER_REGISTERED: "Üye kaydı",
  MEMBER_ACCESS_UPDATED: "Üye yetkisi/durumu değişti",
  MEMBER_DEVICE_RESET: "Yoklama cihazı sıfırlandı",
  MEMBER_MFA_RESET: "İki aşamalı doğrulama sıfırlandı",
  MEMBER_CLAIMS_SYNCED: "Yetki önbelleği güncellendi",
  MEMBER_CLAIMS_INITIALIZED: "Yetki önbelleği oluşturuldu",
  INVITATION_CREATED: "Davet oluşturuldu",
  INVITATION_REVOKED: "Davet iptal edildi",
  CALCULATOR_NOTE_UPDATED: "Hesaplayıcı protokol notu güncellendi",
  CALCULATOR_NOTE_CLEARED: "Hesaplayıcı protokol notu kaldırıldı",
  ATTENDANCE_SESSION_STARTED: "Ders yoklaması başladı",
  ATTENDANCE_SESSION_CLOSED: "Ders yoklaması bitirildi",
  ATTENDANCE_SESSION_EXPIRED: "Ders yoklamasının süresi doldu",
  ATTENDANCE_DEVICE_REGISTERED: "Yoklama cihazı kaydedildi",
  ATTENDANCE_DEVICE_REGISTRATION_REJECTED: "Yoklama cihazı kaydı reddedildi",
  ATTENDANCE_VERIFIED: "Yoklama verildi",
  ATTENDANCE_MARKED_EXCUSED: "Mazeret işlendi",
  ATTENDANCE_EXCUSE_UPDATED: "Mazeret güncellendi",
  ATTENDANCE_EXPIRED_OR_INVALID_CODE: "Geçersiz/eski yoklama kodu",
  ATTENDANCE_DEVICE_ASSERTION_REJECTED: "Cihaz doğrulaması reddedildi",
  ATTENDANCE_DEVICE_CHALLENGE_EXPIRED_OR_REUSED: "Cihaz doğrulaması süresi doldu/tekrar",
  QUIZ_DRAFT_CREATED_FROM_CSV: "Sınav taslağı oluşturuldu",
  QUIZ_DRAFT_UPDATED: "Sınav taslağı güncellendi",
  QUIZ_DRAFT_DELETED: "Sınav taslağı silindi",
  QUIZ_PUBLISHED: "Sınav yayınlandı",
  QUIZ_CLOSED_AND_ARCHIVED: "Sınav kapatıldı",
  QUIZ_CLOSED_AT_DEADLINE: "Sınav kapanış zamanında kapandı",
  QUIZ_ATTEMPT_STARTED: "Sınava girildi",
  QUIZ_ATTEMPT_SUBMITTED: "Sınav teslim edildi",
  QUIZ_ATTEMPT_AUTO_SUBMITTED: "Sınav otomatik teslim edildi",
  MATERIAL_DRAFT_CREATED: "Materyal taslağı oluşturuldu",
  MATERIAL_PUBLISHED: "Materyal yayınlandı",
  MATERIAL_UPDATED: "Materyal güncellendi",
  MATERIAL_DELETED: "Materyal silindi",
};

export const auditActionLabel = (action: string) => AUDIT_ACTION_LABEL[action] ?? action;
