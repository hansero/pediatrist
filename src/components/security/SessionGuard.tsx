"use client";

import Link from "next/link";
import React, { useRef, useState } from "react";
import { KVKK_NOTICE_APPROVED, KVKK_NOTICE_VERSION } from "@shared/consent";
import { EmailVerification } from "@/components/auth/EmailVerification";
import { KvkkDraftNotice } from "@/components/auth/KvkkDraftNotice";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog } from "@/components/ui/Dialog";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { acceptConsent } from "@/lib/firebase/callables";
import { IdleProvider, useIdle } from "@/lib/auth/IdleContext";
import { needsConsent, type SignOutReason } from "@/lib/auth/sessionDecision";
import type { ClinicMemberSession } from "@/lib/auth/types";

interface SessionGuardProps {
  session: ClinicMemberSession | null;
  requireAdmin?: boolean;
  onSignOut: (reason?: SignOutReason) => Promise<void>;
  children: React.ReactNode;
}

/**
 * Korumalı içerik bekçisi (F3.3):
 * - Etkin olmayan üye içerik görmez: onay bekleyen için bekleme ekranı (F3.5); askıdaki üye F2.4'te zaten
 *   oturumdan çıkarılır ve giriş ekranında nedeni görür.
 * - Aydınlatma metninin güncel sürümünü onaylamamış üye onay ekranını görür (F9.1).
 * - Hareketsizlik: 14. dakikada uyarı diyalogu, 15. dakikada GERÇEK çıkış (`?neden=hareketsizlik`).
 *   İstemcide doğrulanamayan "kilidi aç" adımı yoktur; devam etmek için yeniden giriş gerekir.
 * - Sınav ve projektör ekranları `useIdleExempt()` ile muaftır (AUDIT C8).
 *
 * Yetkinin asıl denetimi kurallarda ve Cloud Functions'tadır; bu bileşen yalnızca arayüzü yönetir.
 */
export function SessionGuard({ session, requireAdmin = false, onSignOut, children }: SessionGuardProps) {
  if (!session) return null;

  if (session.status === "pending") {
    return <PendingNotice session={session} onSignOut={onSignOut} />;
  }
  if (session.status !== "active") {
    // Askıdaki üye oturum bağlamında hemen çıkarılır (`?neden=askida`, F2.4); bu yalnızca ara durum.
    return (
      <main className="app-content" aria-busy="true">
        <p className="page-header-subtitle">Oturum kapatılıyor…</p>
      </main>
    );
  }

  // D21: e-posta doğrulaması zorunluysa doğrulanmamış üye veriye erişemez (kurallar ve sunucu da reddeder).
  if (session.emailVerificationRequired && !session.emailVerified) {
    return <EmailVerificationGate session={session} onSignOut={onSignOut} />;
  }

  // F9.1: aydınlatma metni güncellendiyse (ya da hiç onaylanmadıysa, ör. konsoldan oluşturulan ilk admin)
  // üye güncel metni onaylamadan devam edemez. MFA zorunlu ama kurulmamışsa önce MFA kurulur: onay
  // callable'ı MFA'lı oturum ister (F13.1; aksi halde kilitlenme).
  if (needsConsent(session, KVKK_NOTICE_VERSION)) {
    return <ConsentGate session={session} onSignOut={onSignOut} />;
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

/**
 * Onay bekleme ekranı (F3.5). Oturum bağlamı profili canlı dinlediği için onay geldiğinde bu ekran
 * kendiliğinden panele dönüşür (F2.4). Teknik terim yok; çıkış yolu ve e-posta doğrulaması burada.
 */
function PendingNotice({ session, onSignOut }: { session: ClinicMemberSession; onSignOut: () => Promise<void> }) {
  const signOut = useAsyncAction(onSignOut);
  return (
    <main className="auth-screen">
      <article className="auth-card auth-stack" aria-labelledby="pending-lock-heading">
        <div>
          <h1 id="pending-lock-heading" className="auth-title">
            Başvurunuz onay bekliyor
          </h1>
          <p className="page-header-subtitle">
            {session.title} {session.fullName} · {session.email}
          </p>
        </div>
        <p>Eğitim sorumlusu başvurunuzu onayladığında bu sayfa kendiliğinden açılır; sayfayı açık bırakabilirsiniz.</p>
        {!session.emailVerified && (
          <EmailVerification
            email={session.email}
            reason="Onay beklerken e-posta adresinizi doğrulayın; hesabınızın güvenliği için gereklidir."
          />
        )}
        {signOut.error && <Alert tone="critical">{signOut.error}</Alert>}
        <div className="ui-actions">
          <Button variant="secondary" loading={signOut.pending} onClick={() => signOut.run()}>
            Çıkış yap
          </Button>
        </div>
      </article>
    </main>
  );
}

/** E-posta doğrulama ekranı (D21). "Doğruladım" token'ı yeniler; oturum bağlamı güncellenince ekran açılır. */
function EmailVerificationGate({
  session,
  onSignOut,
}: {
  session: ClinicMemberSession;
  onSignOut: () => Promise<void>;
}) {
  const signOut = useAsyncAction(onSignOut);
  return (
    <main className="auth-screen">
      <article className="auth-card auth-stack" aria-labelledby="verify-email-heading">
        <h1 id="verify-email-heading" className="auth-title">
          E-posta adresinizi doğrulayın
        </h1>
        <EmailVerification
          email={session.email}
          reason="Platformu kullanmaya devam etmek için e-posta adresinizin size ait olduğunu doğrulamanız gerekiyor."
        />
        {signOut.error && <Alert tone="critical">{signOut.error}</Alert>}
        <div className="ui-actions">
          <Button variant="secondary" loading={signOut.pending} onClick={() => signOut.run()}>
            Çıkış yap
          </Button>
        </div>
      </article>
    </main>
  );
}

/**
 * KVKK aydınlatma metni onayı (F9.1). Onay sunucuya sürüm ve zamanla kaydedilir; oturum bağlamı profili canlı
 * dinlediği için kayıttan sonra bu ekran kendiliğinden kapanır.
 */
function ConsentGate({ session, onSignOut }: { session: ClinicMemberSession; onSignOut: () => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [missing, setMissing] = useState(false);
  const accept = useAsyncAction(acceptConsent);
  const signOut = useAsyncAction(onSignOut);
  const updated = session.consentVersion !== null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checked) return setMissing(true);
    await accept.run({ consentVersion: KVKK_NOTICE_VERSION });
  }

  return (
    <main className="auth-screen">
      <article className="auth-card auth-stack" aria-labelledby="consent-gate-heading">
        <div>
          <h1 id="consent-gate-heading" className="auth-title">
            {updated ? "Aydınlatma metni güncellendi" : "Aydınlatma metnini onaylayın"}
          </h1>
          <p className="page-header-subtitle">
            {session.title} {session.fullName} · {session.email}
          </p>
        </div>
        <p>
          {updated
            ? `Kişisel verilerinizin nasıl işlendiğini anlatan metin değişti (sürüm ${KVKK_NOTICE_VERSION}). Devam etmek için güncel metni okuyup onaylayın.`
            : "Devam etmek için kişisel verilerinizin nasıl işlendiğini anlatan metni okuyup onaylayın."}
        </p>
        {!KVKK_NOTICE_APPROVED && <KvkkDraftNotice />}
        <form className="auth-stack" onSubmit={onSubmit} noValidate>
          {accept.error && <Alert tone="critical">{accept.error}</Alert>}
          <div className="consent-row">
            <input
              id="consent-gate-check"
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                setChecked(e.target.checked);
                setMissing(false);
              }}
              aria-invalid={missing ? true : undefined}
              aria-describedby={missing ? "consent-gate-error" : undefined}
            />
            <label htmlFor="consent-gate-check">
              <Link href="/kvkk" target="_blank" rel="noopener">
                KVKK aydınlatma metnini
              </Link>{" "}
              okudum.
            </label>
          </div>
          {missing && (
            <p id="consent-gate-error" className="ui-field-error">
              Devam etmek için aydınlatma metnini okuduğunuzu onaylayın.
            </p>
          )}
          {signOut.error && <Alert tone="critical">{signOut.error}</Alert>}
          <div className="ui-actions">
            <Button type="submit" loading={accept.pending} loadingText="Kaydediliyor…">
              Onayla
            </Button>
            <Button variant="secondary" loading={signOut.pending} onClick={() => signOut.run()}>
              Çıkış yap
            </Button>
          </div>
        </form>
      </article>
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
