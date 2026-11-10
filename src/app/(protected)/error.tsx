"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/nav/ErrorPanel";

/** Korumalı sayfa hatası: menü ve oturum yerinde kalır, yalnızca içerik alanı hata gösterir (F3.2). */
export default function ProtectedError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);
  return <ErrorPanel digest={error.digest} onRetry={reset} />;
}
