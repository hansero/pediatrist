"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";
import { passkeySupport, registerAttendanceDevice, type PasskeySupport } from "@/lib/webauthn";

const SUPPORT_MESSAGES: Record<Exclude<PasskeySupport, "supported">, string> = {
  unsupported:
    "Bu tarayıcı cihaz doğrulamasını (passkey) desteklemiyor. Telefonunuzun güncel Safari veya Chrome tarayıcısını kullanın.",
  "no-platform-authenticator":
    "Bu cihazda yüz tanıma, parmak izi veya ekran kilidi etkin değil. Telefonunuzda ekran kilidini açıp tekrar deneyin.",
};

/**
 * Yoklama cihazı (F4.2, D6): bu telefonu hesabın yoklama cihazı olarak kaydeder (WebAuthn platform passkey).
 * Yoklama verirken yüz/parmak izi doğrulaması istenir ve imza sunucuda doğrulanır. Hesap başına tek cihaz;
 * telefon değişirse eğitim sorumlusu kaydı sıfırlar.
 */
export default function AttendanceDevicePage() {
  const { session } = useClinicSession();
  const [support, setSupport] = useState<PasskeySupport | null>(null);
  const register = useAsyncAction(registerAttendanceDevice);

  useEffect(() => {
    let alive = true;
    passkeySupport()
      .then((s) => alive && setSupport(s))
      .catch(() => alive && setSupport("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  if (!session) return null;
  const registered = session.hasBoundDevice;

  return (
    <>
      <PageHeader
        title="Yoklama cihazı"
        description="Derste yoklama verirken kullanacağınız telefonu bir kez kaydedin. Yoklamada telefonunuzun yüz tanıma veya parmak izi onayı istenir."
      />
      <Card
        title="Bu hesaba kayıtlı cihaz"
        actions={
          <StatusChip tone={registered ? "success" : "warning"}>{registered ? "Kayıtlı" : "Kayıtlı değil"}</StatusChip>
        }
      >
        <div className="auth-stack">
          {registered ? (
            <>
              <p>
                Yoklama cihazınız kayıtlı. Telefonunuz değiştiyse veya kaybolduysa eğitim sorumlusundan cihaz kaydını
                sıfırlamasını isteyin; ardından yeni telefonunuzu buradan kaydedin.
              </p>
              {register.data && (
                <Alert tone="success" title="Cihaz kaydedildi">
                  {register.data.backedUp
                    ? "Passkey'iniz hesabınızın anahtar zinciriyle eşitlendi; aynı hesaba bağlı diğer cihazlarınızda da kullanılabilir."
                    : "Passkey yalnızca bu cihazda saklanıyor."}
                </Alert>
              )}
            </>
          ) : (
            <>
              <ol className="setup-steps">
                <li>Bu sayfayı derste kullanacağınız telefonda açın.</li>
                <li>&quot;Bu cihazı kaydet&quot;e dokunun ve yüz/parmak izi onayını verin.</li>
                <li>Derste projektördeki kodu girip aynı onayla yoklamaya katılın.</li>
              </ol>
              {support && support !== "supported" && <Alert tone="warning">{SUPPORT_MESSAGES[support]}</Alert>}
              {register.error && <Alert tone="critical">{register.error}</Alert>}
              <div className="ui-actions">
                <Button
                  loading={register.pending}
                  loadingText="Onay bekleniyor…"
                  disabled={support === null || support === "unsupported"}
                  onClick={() => register.run()}
                >
                  Bu cihazı kaydet
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </>
  );
}
