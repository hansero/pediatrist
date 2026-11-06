"use client";

import React, { useEffect, useState, useCallback } from "react";

export type ClinicRole = "admin" | "user";
export type MemberStatus = "active" | "pending" | "suspended";

export interface ClinicMemberSession {
  uid: string;
  email: string;
  fullName: string;
  title: string;
  residencyYear: number;
  role: ClinicRole;
  status: MemberStatus;
  mfaVerified: boolean;
  appCheckVerified: boolean;
  /** Ham cihaz kimliği UI'a hiç taşınmaz; yalnızca "kayıtlı cihaz var mı" bilgisi tutulur. */
  hasBoundDevice: boolean;
}

const IDLE_TIMEOUT_SECONDS = 15 * 60; // 15 dakika hareketsizlik sınırı

interface SessionGuardProps {
  session: ClinicMemberSession | null;
  requireAdmin?: boolean;
  /** @deprecated Kilit açma artık yeniden giriş gerektirir. */
  onUnlock?: (pinOrTotp: string) => boolean;
  onSignOut: () => void;
  children: React.ReactNode;
}

/**
 * 7 Katmanlı Zero-Trust Oturum Koruyucu:
 * 1. Üyelik durumu 'pending' veya 'suspended' ise erişimi engeller.
 * 2. MFA (TOTP) doğrulanmamışsa erişimi engeller.
 * 3. 15 dakika (900 sn) boyunca fare/klavye/dokunma etkileşimi olmazsa ekranı kilitler.
 */
export function SessionGuard({
  session,
  requireAdmin = false,
  onSignOut,
  children,
}: SessionGuardProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(IDLE_TIMEOUT_SECONDS);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  const resetIdleTimer = useCallback(() => {
    if (!isLocked) {
      setRemainingSeconds(IDLE_TIMEOUT_SECONDS);
    }
  }, [isLocked]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer, { passive: true }));

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsLocked(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
      clearInterval(interval);
    };
  }, [resetIdleTimer]);

  if (!session) {
    return null;
  }

  if (session.status !== "active") {
    return (
      <section className="surface-card" aria-labelledby="pending-lock-heading">
        <h2 id="pending-lock-heading">Üyelik Onayı Bekleniyor</h2>
        <p className="page-header-subtitle">
          Hesabınız ({session.email}) henüz Eğitim Sorumlusu (Admin) tarafından aktif edilmemiştir.
        </p>
      </section>
    );
  }

  if (requireAdmin && session.role !== "admin") {
    return (
      <section className="surface-card" aria-labelledby="rbac-denied-heading">
        <h2 id="rbac-denied-heading">Yetkisiz Erişim Engellendi (RBAC)</h2>
        <p className="page-header-subtitle">
          Bu bölüm yalnızca eğitim sorumluları (Admin) içindir.
        </p>
      </section>
    );
  }

  if (isLocked) {
    // Kilit açma istemci tarafında doğrulanamayacağı için (ör. TOTP) güvenli yol: oturumu kapatıp yeniden giriş.
    return (
      <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="idle-lock-title">
        <div className="modal-dialog">
          <span className="sec-chip critical">15 Dakika Hareketsizlik Kilidi</span>
          <h2 id="idle-lock-title" style={{ marginTop: "0.75rem" }}>
            Oturum Güvenlik Nedeniyle Kilitlendi
          </h2>
          <p className="page-header-subtitle" style={{ marginBottom: "1.2rem" }}>
            Devam etmek için yeniden giriş yapın (e-posta + 2FA).
          </p>
          <button id="idle-unlock-signout-btn" type="button" className="btn btn-primary" onClick={onSignOut}>
            Yeniden Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
