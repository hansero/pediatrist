"use client";

import React, { useRef } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog } from "@/components/ui/Dialog";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { IdleProvider, useIdle } from "@/lib/auth/IdleContext";
import type { SignOutReason } from "@/lib/auth/sessionDecision";
import type { ClinicMemberSession } from "@/lib/auth/types";

interface SessionGuardProps {
  session: ClinicMemberSession | null;
  requireAdmin?: boolean;
  onSignOut: (reason?: SignOutReason) => Promise<void>;
  children: React.ReactNode;
}

/**
 * Korumalı içerik bekçisi (F3.3):
 * - Etkin olmayan üye içerik görmez (askıdaki üye F2.4'te zaten oturumdan çıkarılır; burada onay bekleyen kalır).
 * - Hareketsizlik: 14. dakikada uyarı diyalogu, 15. dakikada GERÇEK çıkış (`?neden=hareketsizlik`).
 *   İstemcide doğrulanamayan "kilidi aç" adımı yoktur; devam etmek için yeniden giriş gerekir.
 * - Sınav ve projektör ekranları `useIdleExempt()` ile muaftır (AUDIT C8).
 *
 * Yetkinin asıl denetimi kurallarda ve Cloud Functions'tadır; bu bileşen yalnızca arayüzü yönetir.
 */
export function SessionGuard({ session, requireAdmin = false, onSignOut, children }: SessionGuardProps) {
  if (!session) return null;

  if (session.status !== "active") {
    // F3.5'te ayrı bekleme ekranına taşınacak; çıkış yolu şimdiden var.
    return <PendingNotice email={session.email} onSignOut={onSignOut} />;
  }

  if (requireAdmin && session.role !== "admin") {
    return (
      <Alert tone="critical" title="Bu bölüme erişiminiz yok">
        Bu sayfa yalnızca eğitim sorumluları içindir.
      </Alert>
    );
  }

  const onTimeout = () => {
    onSignOut("hareketsizlik").catch((err: unknown) => {
      // Yerel çıkış başarısız olsa bile ekran açık bırakılmaz.
      console.error("[idle] çıkış başarısız", err);
      window.location.replace("/login?neden=hareketsizlik");
    });
  };

  return (
    <IdleProvider onTimeout={onTimeout}>
      {children}
      <IdleWarningDialog onSignOut={onSignOut} />
    </IdleProvider>
  );
}

function PendingNotice({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  const signOut = useAsyncAction(onSignOut);
  return (
    <main className="app-content">
      <section className="surface-card status-page" aria-labelledby="pending-lock-heading">
        <h1 id="pending-lock-heading">Üyelik Onayı Bekleniyor</h1>
        <p className="page-header-subtitle">
          Hesabınız ({email}) eğitim sorumlusunun onayını bekliyor. Onaylandığında bu sayfa kendiliğinden açılır.
        </p>
        {signOut.error && <Alert tone="critical">{signOut.error}</Alert>}
        <Button variant="secondary" loading={signOut.pending} onClick={() => signOut.run()}>
          Çıkış yap
        </Button>
      </section>
    </main>
  );
}

function IdleWarningDialog({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const { warning, deadlineMs, stayActive } = useIdle();
  const continueRef = useRef<HTMLButtonElement>(null);
  const signOut = useAsyncAction(onSignOut);

  return (
    <Dialog
      open={warning}
      onClose={stayActive}
      role="alertdialog"
      title="Oturumunuz kapanmak üzere"
      initialFocusRef={continueRef}
      description={
        <>
          Bir süredir işlem yapmadınız. Güvenliğiniz için oturumunuz{" "}
          <Countdown deadlineMs={deadlineMs} label="Oturumun kapanmasına kalan süre" warnAtSeconds={[10]} /> sonra
          kapanacak.
        </>
      }
    >
      {signOut.error && <Alert tone="critical">{signOut.error}</Alert>}
      <div className="ui-dialog-actions">
        <Button variant="secondary" loading={signOut.pending} onClick={() => signOut.run()}>
          Şimdi çıkış yap
        </Button>
        <Button ref={continueRef} onClick={stayActive}>
          Devam et
        </Button>
      </div>
    </Dialog>
  );
}
