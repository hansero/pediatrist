"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Bileşen tarayıcıda hydrate olduysa `true`. Sunucu çıktısında ve hydration sırasında `false`.
 *
 * N3: JavaScript yüklenmeden tıklanan bir gönder butonu formu tarayıcının varsayılan (GET) gönderimiyle
 * yollar; sayfa yenilenir ve kullanıcı "hiçbir şey olmadı" sanır. `Button` hydrate olana kadar
 * `disabled` kalır.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
