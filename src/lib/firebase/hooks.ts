"use client";

import { useEffect, useState } from "react";
import { onSnapshot, Query, DocumentData, Timestamp } from "firebase/firestore";

/** Firestore sorgusunu gerçek zamanlı dinler. Sorgu `null` ise (ör. oturum yok) boş liste döner. */
export function useLiveQuery<T = DocumentData>(q: Query | null, deps: unknown[] = []) {
  const [rows, setRows] = useState<Array<T & { id: string }>>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(q));
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!q) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        setLoading(false);
      },
      () => {
        // Kural reddi vb. durumlarda teknik ayrıntı gösterilmez.
        setError("Veriler yüklenemedi.");
        setLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { rows, loading, error };
}

export function tsToMillis(v: unknown): number {
  if (!v) return 0;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  const maybe = v as { toMillis?: () => number };
  return typeof maybe.toMillis === "function" ? maybe.toMillis() : 0;
}

export function formatDateTime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}
