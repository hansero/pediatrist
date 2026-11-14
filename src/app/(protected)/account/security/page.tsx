"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { EmailVerification } from "@/components/auth/EmailVerification";
import { PersonalDataCard } from "@/components/auth/PersonalDataCard";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";
import {
  enrolledFactors,
  finishTotpEnrollment,
  startTotpEnrollment,
  unenrollFactor,
  type EnrolledFactorView,
  type TotpEnrollment,
} from "@/lib/auth/mfa";
import { AppError } from "@/lib/errors";
import { initPediatristFirebase, isUsingEmulators } from "@/lib/firebase/client";

function currentUser(): User {
  const user = initPediatristFirebase()?.auth.currentUser;
  if (!user) throw new AppError("unauthenticated", "Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.");
  return user;
}

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short" });

/**
 * Hesap güvenliği (F3.4): Authenticator (TOTP) ile iki aşamalı doğrulama kurulumu.
 * Identity Platform kuralları: e-posta doğrulanmış olmalı, oturum yeni olmalı. Kurulum tamamlanınca
 * oturum kapatılır ve kullanıcı yeni koduyla giriş yapar (sunucu `sign_in_second_factor` ister; ayrıca
 * kurulumun gerçekten çalıştığı ilk girişte kanıtlanır).
 */
export default function AccountSecurityPage() {
  const { session, signOutUser } = useClinicSession();
  const [factors, setFactors] = useState<EnrolledFactorView[]>([]);
  // Liste, oturum bağlamı değişince ve bir yöntem kaldırılınca yeniden okunur (F13.4: birden çok yöntem varken
  // `mfaEnrolled` değişmediği için kaldırılan yöntem listede kalıyordu).
  const refreshFactors = useCallback(() => {
    const user = initPediatristFirebase()?.auth.currentUser;
    setFactors(user ? enrolledFactors(user) : []);
  }, []);

  useEffect(() => {
    refreshFactors();
  }, [session?.mfaEnrolled, refreshFactors]);

  if (!session) return null;
  const required = session.mfaRequired;

  return (
    <>
      <PageHeader
        title="Hesap güvenliği"
        description="Girişte şifrenize ek olarak telefonunuzdaki Authenticator uygulamasının ürettiği kod istenir."
      />
      {required && !session.mfaEnrolled && (
        <Alert tone="warning" title="İki aşamalı doğrulama gerekli">
          Platformu kullanmaya devam etmek için aşağıdaki kurulumu tamamlayın.
        </Alert>
      )}
      <div className="attendance-admin">
        <Card
          title="İki aşamalı doğrulama"
          actions={
            <StatusChip tone={session.mfaEnrolled ? "success" : "warning"}>
              {session.mfaEnrolled ? "Etkin" : "Kapalı"}
            </StatusChip>
          }
        >
          {session.mfaEnrolled ? (
            <EnrolledFactors factors={factors} canRemove={!required} onRemoved={refreshFactors} />
          ) : !session.emailVerified ? (
            <EmailVerification
              email={session.email}
              reason="Güvenlik gereği iki aşamalı doğrulama yalnızca doğrulanmış e-posta adresine kurulabilir."
            />
          ) : (
            <TotpSetup onDone={() => signOutUser("mfa-kuruldu")} />
          )}
        </Card>
        <PersonalDataCard session={session} />
      </div>
    </>
  );
}

function TotpSetup({ onDone }: { onDone: () => Promise<void> }) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");

  const start = useAsyncAction(async () => {
    const result = await startTotpEnrollment(currentUser());
    setQr(await QRCode.toDataURL(result.otpauthUrl, { errorCorrectionLevel: "M", margin: 1, width: 220 }));
    setEnrollment(result);
    return true as const;
  });

  const finish = useAsyncAction(async () => {
    if (!enrollment) throw new AppError("failed-precondition", "Önce kurulumu başlatın.");
    await finishTotpEnrollment(currentUser(), enrollment, code);
    await onDone();
    return true as const;
  });

  if (isUsingEmulators()) {
    // Firebase Auth emülatörü TOTP kaydını desteklemiyor (F3.4'te denendi); düğme yerine dürüst açıklama.
    return (
      <Alert tone="info" title="Yerel test ortamı">
        Authenticator kurulumu Firebase emülatöründe desteklenmiyor. Bu adım staging ortamında test edilir.
      </Alert>
    );
  }

  if (!enrollment) {
    return (
      <div className="auth-stack">
        <p className="page-header-subtitle">
          Telefonunuza Google Authenticator, Microsoft Authenticator veya benzeri bir uygulama kurun, ardından kurulumu
          başlatın.
        </p>
        {start.error && <Alert tone="critical">{start.error}</Alert>}
        <div className="ui-actions">
          <Button loading={start.pending} loadingText="Hazırlanıyor…" onClick={() => start.run()}>
            Kurulumu başlat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="auth-stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void finish.run();
      }}
    >
      <ol className="setup-steps">
        <li>Authenticator uygulamasında yeni hesap ekleyin ve bu QR kodunu taratın.</li>
        <li>Tarayamıyorsanız anahtarı elle girin (zaman tabanlı).</li>
        <li>Uygulamanın gösterdiği 6 haneli kodu aşağıya yazın.</li>
      </ol>
      <div className="totp-setup">
        {/* QR yerel olarak üretilir (data: URL); anahtar hiçbir sunucuya gönderilmez. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} width={220} height={220} alt="Authenticator uygulaması için kurulum QR kodu" />
        <div>
          <p className="form-label">Elle giriş anahtarı</p>
          <code className="totp-key mono-num">{enrollment.displayKey}</code>
        </div>
      </div>
      <Field label="Doğrulama kodu" required>
        {(p) => (
          <input
            {...p}
            type="text"
            className="form-input mono-num totp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
          />
        )}
      </Field>
      {finish.error && <Alert tone="critical">{finish.error}</Alert>}
      <div className="ui-actions">
        <Button type="submit" loading={finish.pending} loadingText="Doğrulanıyor…">
          Doğrula ve etkinleştir
        </Button>
      </div>
    </form>
  );
}

function EnrolledFactors({
  factors,
  canRemove,
  onRemoved,
}: {
  factors: EnrolledFactorView[];
  canRemove: boolean;
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = useState<EnrolledFactorView | null>(null);
  return (
    <>
      <ul className="factor-list">
        {factors.map((f) => (
          <li key={f.uid} className="factor-item">
            <div>
              <strong>{f.displayName}</strong>
              <p className="page-header-subtitle">Eklenme: {dateFormat.format(new Date(f.enrolledAt))}</p>
            </div>
            {canRemove && (
              <Button variant="secondary" size="sm" onClick={() => setRemoving(f)}>
                Kaldır
              </Button>
            )}
          </li>
        ))}
      </ul>
      {!canRemove && (
        <p className="page-header-subtitle">
          İki aşamalı doğrulama bu platformda zorunludur. Telefonunuzu kaybederseniz eğitim sorumlusuyla iletişime
          geçin.
        </p>
      )}
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Doğrulama yöntemini kaldır"
        description={`"${removing?.displayName ?? ""}" kaldırılırsa girişte yalnızca şifre istenir. Oturumunuz kapanabilir.`}
        confirmLabel="Kaldır"
        pendingLabel="Kaldırılıyor…"
        onConfirm={async () => {
          if (!removing) return;
          await unenrollFactor(currentUser(), removing.uid);
          onRemoved();
        }}
      />
    </>
  );
}
