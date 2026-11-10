"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toUserMessage } from "@/lib/errors";

export interface AsyncActionState<R> {
  pending: boolean;
  /** Kullanıcıya gösterilecek Türkçe hata metni ("" = hata yok). */
  error: string;
  data: R | undefined;
}

/**
 * Sunucu mutasyonları için durum kancası (F1.4, CLAUDE.md kural 2):
 * - `run(...)` işlem bitene kadar `pending` döner; sonuç gelmeden "başarılı" gösterilmez.
 * - Hata `toUserMessage()` ile Türkçe metne çevrilip `error`'a yazılır; `run` bu durumda `undefined` döner.
 * - Çift tıklama koruması: bir çağrı sürerken yeni `run` çağrısı yok sayılır.
 * - Bileşen kaldırıldıktan sonra state güncellenmez.
 */
export function useAsyncAction<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  const [state, setState] = useState<AsyncActionState<R>>({ pending: false, error: "", data: undefined });
  const actionRef = useRef(action);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    if (pendingRef.current) return undefined;
    pendingRef.current = true;
    setState((s) => ({ ...s, pending: true, error: "" }));
    try {
      const data = await actionRef.current(...args);
      if (mountedRef.current) setState({ pending: false, error: "", data });
      return data;
    } catch (err) {
      if (mountedRef.current) setState((s) => ({ ...s, pending: false, error: toUserMessage(err) }));
      return undefined;
    } finally {
      pendingRef.current = false;
    }
  }, []);

  const reset = useCallback(() => setState({ pending: false, error: "", data: undefined }), []);

  return { ...state, run, reset };
}
