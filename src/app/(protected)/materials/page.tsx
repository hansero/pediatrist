"use client";

import { MaterialsAdmin } from "@/components/materials/admin/MaterialsAdmin";
import { DoctorMaterials } from "@/components/materials/viewer/DoctorMaterials";
import { PageHeader } from "@/components/ui/PageHeader";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";

/**
 * Materyaller (/materials). Eğitim sorumlusu: materyal yönetimi (F6.2). Hekim: yayındaki materyaller ve
 * filigranlı görüntüleme, okuma ilerlemesi (F6.3). Bütün veri Firestore/Storage'dan; yazmalar callable'larda
 * (hekimin kendi ilerlemesi hariç: kurallar şemasını denetler).
 */
export default function MaterialsPage() {
  const { session } = useClinicSession();
  if (!session) return null;
  const isAdmin = session.role === "admin";
  return (
    <>
      <PageHeader
        title={isAdmin ? "Materyal yönetimi" : "Eğitim materyalleri"}
        description={
          isAdmin
            ? "PDF, video veya görsel yükleyin; hedef kıdemi seçin, okunma durumunu izleyin."
            : "Kıdeminize yönelik materyaller. Görüntüleme filigranlıdır; okuma ilerlemeniz kaydedilir."
        }
      />
      {isAdmin ? <MaterialsAdmin /> : <DoctorMaterials session={session} />}
    </>
  );
}
