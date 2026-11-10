"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/**
 * Rota hata paneli. Teknik ayrıntı (stack, mesaj) gösterilmez; yalnızca destek için Next'in hata özeti
 * (`digest`) gösterilir. Sunucu loglarında aynı özetle eşleşir.
 */
export function ErrorPanel({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  return (
    <div className="status-page">
      <h1>Bir şeyler ters gitti</h1>
      <Alert tone="critical">
        Bu sayfa yüklenirken beklenmeyen bir hata oluştu. Tekrar deneyin; sorun sürerse eğitim sorumlusuna bildirin.
        {digest && <span className="mono-num"> Hata kodu: {digest}</span>}
      </Alert>
      <div className="ui-actions">
        <Button onClick={onRetry}>Tekrar dene</Button>
        <Link href="/dashboard" className="btn btn-secondary">
          Genel bakışa dön
        </Link>
      </div>
    </div>
  );
}
