"use client";

import { Calculators } from "@/components/calculators/Calculators";
import { PageHeader } from "@/components/ui/PageHeader";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";

/** Pediatri hesaplayıcıları (F7.4, D8): planlanan araçlar ve kliniğin protokol notları; hesaplama yok. */
export default function CalculatorsPage() {
  const { session } = useClinicSession();
  if (!session) return null;
  return (
    <>
      <PageHeader
        title="Pediatri hesaplayıcıları"
        description={
          session.role === "admin"
            ? "Planlanan hesaplayıcılar ve her biri için kliniğin protokol notu."
            : "Planlanan hesaplayıcılar ve kliniğin protokol notları."
        }
      />
      <Calculators isAdmin={session.role === "admin"} />
    </>
  );
}
