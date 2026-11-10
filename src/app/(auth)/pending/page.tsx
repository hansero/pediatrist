import { redirect } from "next/navigation";

/**
 * Eski bekleme adresi (F3.5). Bekleme ekranı artık korumalı alanda: oturum bağlamı profili canlı dinler
 * ve onay geldiğinde ekran kendiliğinden panele döner. Eski bağlantılar oraya yönlendirilir.
 */
export default function PendingRedirect() {
  redirect("/dashboard");
}
