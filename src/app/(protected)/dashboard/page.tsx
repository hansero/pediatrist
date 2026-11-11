"use client";

import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { DoctorDashboard } from "@/components/dashboard/DoctorDashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";

/** Genel bakış (F7.3): şu an yapılacak tek iş ve gerçek göstergeler. Sabit sayı yok. */
export default function DashboardPage() {
  const { session } = useClinicSession();
  if (!session) return null;
  return (
    <>
      <PageHeader
        title={`Hoş geldiniz, ${session.title} ${session.fullName}`}
        description={
          session.role === "admin" ? "Klinik eğitiminin bugünkü durumu." : "Bugün sizi bekleyenler ve gelişiminiz."
        }
      />
      {session.role === "admin" ? <AdminDashboard /> : <DoctorDashboard session={session} />}
    </>
  );
}
