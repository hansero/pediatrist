"use client";

import { QuizAdmin } from "@/components/quizzes/admin/QuizAdmin";
import { DoctorQuizzes } from "@/components/quizzes/doctor/DoctorQuizzes";
import { PageHeader } from "@/components/ui/PageHeader";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";

/**
 * Sınavlar (/quizzes). Eğitim sorumlusu: sınav stüdyosu (F5.2). Hekim: yayındaki sınav, sınav ekranı ve
 * sonuçlar (F5.3). Bütün veri Firestore'dan ve callable'lardan gelir; puanlama yalnızca sunucuda.
 */
export default function QuizzesPage() {
  const { session } = useClinicSession();
  if (!session) return null;
  const isAdmin = session.role === "admin";
  return (
    <>
      <PageHeader
        title={isAdmin ? "Sınav yönetimi" : "Sınavlar"}
        description={
          isAdmin
            ? "CSV ile sınav hazırlayın, önizleyin, yayınlayın ve kapatın. Puanlama sunucuda yapılır."
            : "Yayındaki sınava girin; yanıtlarınız otomatik kaydedilir. Puanlama sunucuda yapılır."
        }
      />
      {isAdmin ? <QuizAdmin /> : <DoctorQuizzes session={session} />}
    </>
  );
}
