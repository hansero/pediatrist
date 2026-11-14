"use client";

import { AdminAttendance } from "@/components/attendance/admin/AdminAttendance";
import { AttendanceHistory } from "@/components/attendance/AttendanceHistory";
import { DoctorCheckIn } from "@/components/attendance/DoctorCheckIn";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ATTENDANCE_INELIGIBLE_MESSAGE, isAttendanceEligible } from "@shared/constants";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";

/** Ders yoklaması (F4.3): eğitim sorumlusu dersi yönetir, hekim projektördeki kodu girerek katılır (D28). */
export default function AttendancePage() {
  const { session } = useClinicSession();
  if (!session) return null;
  const isAdmin = session.role === "admin";
  if (!isAdmin && !isAttendanceEligible(session)) {
    // D24: uzman ve öğretim üyeleri yoklamaya tabi değil (menüde de görünmez; adresle gelinirse açıklama).
    return (
      <>
        <PageHeader title="Ders yoklaması" />
        <Card title="Ders yoklaması">
          <EmptyState
            title={ATTENDANCE_INELIGIBLE_MESSAGE}
            description="Uzman ve öğretim üyesi hesaplarında yoklama verilmez."
          />
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Ders yoklaması"
        description={
          isAdmin
            ? "Dersi başlatın, projektör ekranını yansıtın ve katılımı canlı izleyin."
            : "Açık derse projektördeki kodu girerek katılın."
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
