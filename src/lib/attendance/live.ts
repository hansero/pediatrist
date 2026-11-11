"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { COLLECTIONS, type AttendanceStatus } from "@shared/types";
import { toUserMessage } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";

/**
 * Yoklama verisinin canlı okunması (F4.3). Bütün yazmalar callable'lardadır; burada yalnızca kuralların izin
 * verdiği okumalar var: hekim yalnızca canlı dersi ve kendi kaydını, admin hepsini okur.
 */

export interface Lecture {
  id: string;
  title: string;
  lecturer: string;
  category: string;
  durationMinutes: number;
  status: "live" | "closed";
  startedAtMs: number;
  endsAtMs: number;
  presentCount: number;
  excusedCount: number;
  expectedAttendees: string[];
  expectedCount: number;
  closeReason?: "manual" | "expired";
}

export interface AttendanceRecordView {
  uid: string;
  fullName: string;
  title: string;
  status: AttendanceStatus;
  verifiedAtMs: number | null;
  excuseNote?: string;
}

export type LiveState<T> =
  | { status: "loading"; data: null; error: "" }
  | { status: "ready"; data: T; error: "" }
  | { status: "error"; data: null; error: string };

const ms = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === "function" ? (v as Timestamp).toMillis() : null;

export function toLecture(id: string, d: DocumentData): Lecture {
  return {
    id,
    title: String(d.title ?? ""),
    lecturer: String(d.lecturer ?? ""),
    category: String(d.category ?? ""),
    durationMinutes: Number(d.durationMinutes ?? 0),
    status: d.status === "live" ? "live" : "closed",
    startedAtMs: ms(d.startedAt) ?? 0,
    endsAtMs: ms(d.endsAt) ?? 0,
    presentCount: Number(d.presentCount ?? 0),
    excusedCount: Number(d.excusedCount ?? 0),
    expectedAttendees: Array.isArray(d.expectedAttendees) ? d.expectedAttendees.map(String) : [],
    expectedCount: Number(d.expectedCount ?? 0),
    closeReason: d.closeReason === "expired" || d.closeReason === "manual" ? d.closeReason : undefined,
  };
}

export function toRecord(d: DocumentData): AttendanceRecordView {
  return {
    uid: String(d.uid ?? ""),
    fullName: String(d.fullName ?? ""),
    title: String(d.title ?? ""),
    status: d.status === "excused" ? "excused" : "present",
    verifiedAtMs: ms(d.verifiedAt),
    excuseNote: typeof d.excuseNote === "string" && d.excuseNote ? d.excuseNote : undefined,
  };
}

/** Süresi dolmuş ama henüz kapatılmamış ders (zamanlayıcı en geç 5 dk içinde kapatır) canlı sayılmaz. */
export function isLectureOpen(lecture: Lecture | null, nowMs = Date.now()): lecture is Lecture {
  return Boolean(lecture && lecture.status === "live" && lecture.endsAtMs > nowMs);
}

function useSnapshot<T>(
  subscribe: (onData: (value: T) => void, onError: (err: unknown) => void) => (() => void) | null,
  deps: unknown[]
): LiveState<T> {
  const [state, setState] = useState<LiveState<T>>({ status: "loading", data: null, error: "" });
  useEffect(() => {
    setState({ status: "loading", data: null, error: "" });
    const unsubscribe = subscribe(
      (data) => setState({ status: "ready", data, error: "" }),
      (err) => setState({ status: "error", data: null, error: toUserMessage(err) })
    );
    if (!unsubscribe) setState({ status: "error", data: null, error: "Sunucu bağlantısı yapılandırılmamış." });
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** Canlı ders (en fazla bir tane; tek canlı ders kilidi sunucuda, F4.1). */
export function useLiveLecture(): LiveState<Lecture | null> {
  return useSnapshot<Lecture | null>((onData, onError) => {
    const db = initPediatristFirebase()?.db;
    if (!db) return null;
    const q = query(collection(db, COLLECTIONS.attendanceSessions), where("status", "==", "live"), limit(1));
    return onSnapshot(
      q,
      (snap) => onData(snap.empty ? null : toLecture(snap.docs[0].id, snap.docs[0].data())),
      onError
    );
  }, []);
}

/** Tek ders (projektör ve admin kartı). */
export function useLecture(sessionId: string | null): LiveState<Lecture | null> {
  return useSnapshot<Lecture | null>(
    (onData, onError) => {
      const db = initPediatristFirebase()?.db;
      if (!db) return null;
      if (!sessionId) {
        onData(null);
        return () => {};
      }
      return onSnapshot(
        doc(db, COLLECTIONS.attendanceSessions, sessionId),
        (snap) => onData(snap.exists() ? toLecture(snap.id, snap.data()) : null),
        onError
      );
    },
    [sessionId]
  );
}

/** Admin: dersin bütün kayıtları. */
export function useLectureRecords(sessionId: string | null): LiveState<AttendanceRecordView[]> {
  return useSnapshot<AttendanceRecordView[]>(
    (onData, onError) => {
      const db = initPediatristFirebase()?.db;
      if (!db) return null;
      if (!sessionId) {
        onData([]);
        return () => {};
      }
      return onSnapshot(
        collection(db, COLLECTIONS.attendanceSessions, sessionId, COLLECTIONS.attendanceRecords),
        (snap) => onData(snap.docs.map((d) => toRecord(d.data()))),
        onError
      );
    },
    [sessionId]
  );
}

/** Hekim: kendi kaydı (kurallar yalnızca kendi kaydını okumaya izin verir). */
export function useMyRecord(sessionId: string | null, uid: string): LiveState<AttendanceRecordView | null> {
  return useSnapshot<AttendanceRecordView | null>(
    (onData, onError) => {
      const db = initPediatristFirebase()?.db;
      if (!db) return null;
      if (!sessionId) {
        onData(null);
        return () => {};
      }
      return onSnapshot(
        doc(db, COLLECTIONS.attendanceSessions, sessionId, COLLECTIONS.attendanceRecords, uid),
        (snap) => onData(snap.exists() ? toRecord(snap.data()) : null),
        onError
      );
    },
    [sessionId, uid]
  );
}

/** Admin: son kapanmış dersler (ayrıntılı raporlar F4.5). */
export function useRecentLectures(count = 10): LiveState<Lecture[]> {
  return useSnapshot<Lecture[]>(
    (onData, onError) => {
      const db = initPediatristFirebase()?.db;
      if (!db) return null;
      const q = query(
        collection(db, COLLECTIONS.attendanceSessions),
        where("status", "==", "closed"),
        orderBy("startedAt", "desc"),
        limit(count)
      );
      return onSnapshot(q, (snap) => onData(snap.docs.map((d) => toLecture(d.id, d.data()))), onError);
    },
    [count]
  );
}

export interface MemberSummary {
  uid: string;
  fullName: string;
  title: string;
  residencyYear: number | null;
  hasDevice: boolean;
}

/** Admin: etkin hekimler (yoklama listesi için). */
export function useActiveDoctors(): LiveState<MemberSummary[]> {
  return useSnapshot<MemberSummary[]>((onData, onError) => {
    const db = initPediatristFirebase()?.db;
    if (!db) return null;
    const q = query(collection(db, COLLECTIONS.users), where("status", "==", "active"), where("role", "==", "user"));
    return onSnapshot(
      q,
      (snap) =>
        onData(
          snap.docs.map((d) => {
            const u = d.data();
            return {
              uid: d.id,
              fullName: String(u.fullName ?? ""),
              title: String(u.title ?? ""),
              residencyYear: typeof u.residencyYear === "number" ? u.residencyYear : null,
              hasDevice: Boolean(u.webauthn?.credentialId),
            };
          })
        ),
      onError
    );
  }, []);
}
