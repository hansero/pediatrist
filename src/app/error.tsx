"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/nav/ErrorPanel";

/** Korumalı alan dışındaki (giriş, kayıt) beklenmeyen hatalar (F3.2). */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <ErrorPanel digest={error.digest} onRetry={reset} />
      </div>
    </main>
  );
}
