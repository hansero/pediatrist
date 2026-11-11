"use client";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";

/**
 * Üyeler ve güvenlik (F7.1, F7.2): üye onayı/rolü/durumu, cihaz ve iki aşamalı doğrulama sıfırlama, davetler,
 * denetim kayıtları. Yetki sunucuda denetlenir (guards.ts); bu sayfadaki kontrol yalnızca gezinme içindir.
 */
export default function AdminPage() {
  const { session } = useClinicSession();
  if (!session) return null;
  if (session.role !== "admin") {
    return (
      <>
        <PageHeader title="Üyeler ve güvenlik" />
        <Alert tone="warning">Bu sayfa yalnızca eğitim sorumlularına açıktır.</Alert>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Üyeler ve güvenlik"
        description="Başvuruları onaylayın, rolleri ve erişimi yönetin, davet oluşturun ve denetim kayıtlarını inceleyin."
      />
      <AdminPanel selfUid={session.uid} />
    </>
  );
}
