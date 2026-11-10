"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/nav/AppShell";
import { SessionGuard } from "@/components/security/SessionGuard";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ClinicSessionProvider, useClinicSession } from "@/lib/auth/ClinicSessionContext";

/**
 * Oturum yok → giriş; hesap açık ama profil yok (ör. kayıt sırasında sekme kapandı) → kayıt ekranı,
 * orada yalnızca profil tamamlanır (F2.3). Yönlendirme render sırasında değil, efektte ve
 * geçmişe kayıt bırakmadan (`replace`) yapılır.
 */
function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return (
    <main className="app-content" aria-busy="true">
      <p className="page-header-subtitle">Yönlendiriliyor…</p>
    </main>
  );
}

/**
 * Korumalı alan: oturum fazlarına göre durum ekranı veya uygulama iskeleti (`AppShell`, F3.2).
 * Rol ve durum yalnızca `users/{uid}` dokümanından gelir (D3). Kenar çubuğunda cihaz kimliği,
 * proje kimliği veya token claim'leri gösterilmez.
 */
function ClinicShell({ children }: { children: React.ReactNode }) {
  const { session, phase, error, signOutUser } = useClinicSession();

  if (phase === "signingOut") {
    return (
      <main className="app-content" aria-busy="true">
        <p className="page-header-subtitle">Oturum kapatılıyor…</p>
      </main>
    );
  }

  if (phase === "loading") {
    return (
      <main className="app-content" aria-busy="true">
        <p className="page-header-subtitle">Oturum doğrulanıyor…</p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="app-content">
        <Alert tone="critical" title="Oturum bilgileri yüklenemedi">
          {error}
        </Alert>
        <Button onClick={() => window.location.reload()}>Tekrar dene</Button>
      </main>
    );
  }

  if (phase === "needsProfile" || phase === "signedOut" || !session) {
    return <Redirect to={phase === "needsProfile" ? "/register" : "/login"} />;
  }

  return (
    <SessionGuard session={session} onUnlock={() => false} onSignOut={signOutUser}>
      <AppShell session={session} onSignOut={signOutUser}>
        {children}
      </AppShell>
    </SessionGuard>
  );
}

export default function ProtectedClinicalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClinicSessionProvider>
      <ClinicShell>{children}</ClinicShell>
    </ClinicSessionProvider>
  );
}
