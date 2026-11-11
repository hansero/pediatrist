"use client";

import { use } from "react";
import { ProjectorKiosk } from "@/components/attendance/ProjectorKiosk";
import { Alert } from "@/components/ui/Alert";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";

/** Projektör ekranı (F4.3): yalnızca eğitim sorumlusu. Kod üretimi sunucuda zaten yalnızca admin'e açık. */
export default function ProjectorPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const { session } = useClinicSession();
  if (!session) return null;
  if (session.role !== "admin") {
    return <Alert tone="critical">Projektör ekranı yalnızca eğitim sorumlusu içindir.</Alert>;
  }
  return <ProjectorKiosk sessionId={decodeURIComponent(sessionId)} />;
}
