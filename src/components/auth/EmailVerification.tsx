"use client";

import { useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { AppError } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";

function currentUser() {
  const user = initPediatristFirebase()?.auth.currentUser;
  if (!user) throw new AppError("unauthenticated", "Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.");
  return user;
}

/**
 * E-posta doğrulama paneli (F3.4, F3.5): bağlantıyı (yeniden) gönderir; "Doğruladım" kullanıcıyı yeniler ve
 * token'ı tazeler, böylece oturum bağlamı güncel `emailVerified` değerini alır.
 */
export function EmailVerification({ email, reason }: { email: string; reason: string }) {
  const [info, setInfo] = useState("");
  const send = useAsyncAction(async () => {
    await sendEmailVerification(currentUser());
    return true as const;
  });
  const refresh = useAsyncAction(async () => {
    const user = currentUser();
    await user.reload();
    await user.getIdToken(true);
    return user.emailVerified;
  });

  return (
    <div className="auth-stack">
      <Alert tone="info" title="E-posta adresinizi doğrulayın">
        {reason} Doğrulama bağlantısı {email} adresine gönderilir.
      </Alert>
      {send.data && <Alert tone="success">Doğrulama bağlantısı gönderildi. E-postanızı kontrol edin.</Alert>}
      {info && <Alert tone="warning">{info}</Alert>}
      {(send.error || refresh.error) && <Alert tone="critical">{send.error || refresh.error}</Alert>}
      <div className="ui-actions">
        <Button variant="secondary" loading={send.pending} onClick={() => send.run()}>
          Doğrulama e-postası gönder
        </Button>
        <Button
          loading={refresh.pending}
          onClick={async () => {
            setInfo("");
            const verified = await refresh.run();
            if (verified === false) setInfo("E-posta adresiniz henüz doğrulanmamış görünüyor.");
          }}
        >
          Doğruladım
        </Button>
      </div>
    </div>
  );
}
