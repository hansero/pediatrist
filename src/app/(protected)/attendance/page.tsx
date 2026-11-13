"use client";

import { AdminAttendance } from "@/components/attendance/admin/AdminAttendance";
import { AttendanceHistory } from "@/components/attendance/AttendanceHistory";
import { DoctorCheckIn } from "@/components/attendance/DoctorCheckIn";
import { PageHeader } from "@/components/ui/PageHeader";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";

/** Ders yoklaması (F4.3): eğitim sorumlusu dersi yönetir, hekim QR okutarak ya da kodu girerek katılır (F11.2). */
export default function AttendancePage() {
  const { session } = useClinicSession();
  if (!session) return null;
  const isAdmin = session.role === "admin";
  return (
    <>
      <PageHeader
        title="Ders yoklaması"
        description={
          isAdmin
            ? "Dersi başlatın, projektör ekranını yansıtın ve katılımı canlı izleyin."
            : "Açık derse projektördeki QR kodu okutarak ya da kodu girerek katılın."
        }
      />
      {isAdmin ? (
        <AdminAttendance session={session} />
      ) : (
        <div className="attendance-admin">
          <DoctorCheckIn session={session} />
          <AttendanceHistory uid={session.uid} />
        </div>
      )}
    </>
  );
}
