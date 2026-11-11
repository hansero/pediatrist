"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { ClinicMemberSession } from "@/lib/auth/types";
import { downloadMemberExport } from "@/lib/privacy";

/**
 * Kişisel verilerim (KVKK md. 11, F9.1): üye, platformda kendisi hakkında tutulan verilerin dökümünü indirir.
 * Silme ve düzeltme talepleri eğitim sorumlusu üzerinden yürür (silme geri alınamaz; yönetim panelinde).
 */
export function PersonalDataCard({ session }: { session: ClinicMemberSession }) {
  const toast = useToast();
  const download = useAsyncAction(async () => {
    await downloadMemberExport(session.uid);
    toast.show("Veri dökümünüz indirildi.", { tone: "success" });
    return true as const;
  });

  return (
    <Card
      title="Kişisel verilerim"
      description="Profiliniz, sınav girişimleriniz ve yanıtlarınız, yoklama kayıtlarınız ve materyal okuma kayıtlarınız tek dosyada."
    >
      <div className="auth-stack">
        {download.error && <Alert tone="critical">{download.error}</Alert>}
        <p className="page-header-subtitle">
          Onayladığınız{" "}
          <Link href="/kvkk" target="_blank" rel="noopener">
            aydınlatma metni
          </Link>{" "}
          sürümü: {session.consentVersion ?? "—"}. Verilerinizin düzeltilmesi veya silinmesi için eğitim sorumlusuna
          başvurun.
        </p>
        <div className="ui-actions">
          <Button
            variant="secondary"
            loading={download.pending}
            loadingText="Hazırlanıyor…"
            onClick={() => download.run()}
          >
            Verilerimi indir
          </Button>
        </div>
      </div>
    </Card>
  );
}
