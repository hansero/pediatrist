"use client";

import { useEffect } from "react";

/**
 * Kök layout'un kendisi çöktüğünde (F3.2). Kök layout ve stilleri yüklenemediği için kendi html/body'sini
 * çizer ve stil sınıflarına güvenmez.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);
  return (
    <html lang="tr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", lineHeight: 1.5 }}>
        <main>
          <h1>Uygulama yüklenemedi</h1>
          <p>Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.</p>
          {error.digest && <p>Hata kodu: {error.digest}</p>}
          <button type="button" onClick={reset} style={{ padding: "0.6rem 1rem", minHeight: 44 }}>
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
