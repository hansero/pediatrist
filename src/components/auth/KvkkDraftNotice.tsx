import { Alert } from "@/components/ui/Alert";

/**
 * Aydınlatma metni kurumun hukuk birimince henüz onaylanmadıysa bunu açıkça söyler (`KVKK_NOTICE_APPROVED`,
 * F9.1). Onay verilince `@shared/consent` içindeki değer `true` yapılır ve bu uyarı kaybolur.
 */
export function KvkkDraftNotice() {
  return (
    <Alert tone="warning" title="Taslak metin">
      Bu aydınlatma metni kurumun KVKK sorumlusu / hukuk birimi tarafından henüz onaylanmamıştır.
    </Alert>
  );
}
