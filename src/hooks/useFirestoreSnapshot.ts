"use client";

import { useEffect, useMemo, useState } from "react";
import { toUserMessage, NOT_CONFIGURED_MESSAGE } from "@/lib/errors";

export type LiveState<T> =
  | { status: "loading"; data: null; error: "" }
  | { status: "ready"; data: T; error: "" }
  | { status: "error"; data: null; error: string };

/**
 * Firestore canlı dinleme kancası (F4.3'ten ortaklaştırıldı, F5.2). `subscribe` dinlemeyi başlatır ve iptal
 * fonksiyonunu döner; yapılandırma yoksa `null` döner (açık hata). Hata Türkçe metne çevrilir; yükleniyor
 * veya hata durumunda eski/uydurma veri gösterilmez.
 */
export function useFirestoreSnapshot<T>(
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
    if (!unsubscribe) setState({ status: "error", data: null, error: NOT_CONFIGURED_MESSAGE });
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** Üst sınırlı liste: `truncated` doğruysa sınırdan fazla kayıt vardır ve liste eksiktir. */
export type CappedState<T> = LiveState<T[]> & { truncated: boolean; cap: number };

/**
 * Sınırlı canlı liste (F8.2). Sorgu `limit(cap + 1)` ile yapılır; fazladan gelen tek kayıt gösterilmez, yalnızca
 * listenin kırpıldığını bildirir. Böylece sınır aşıldığında liste sessizce eksik kalmaz: ekran bunu söyler.
 */
export function useCapped<T>(state: LiveState<T[]>, cap: number): CappedState<T> {
  const data = state.data;
  const items = useMemo(() => (data && data.length > cap ? data.slice(0, cap) : data), [data, cap]);
  const truncated = Boolean(data && data.length > cap);
  if (state.status !== "ready") return { ...state, truncated: false, cap };
  return { status: "ready", data: items ?? [], error: "", truncated, cap };
}
