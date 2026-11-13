"use client";

import React, { useEffect, useRef, useState } from "react";
import { ATTENDANCE_CODE_LENGTH } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Countdown } from "@/components/ui/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { isLectureOpen, useLiveLecture, useMyRecord } from "@/lib/attendance/live";
import type { ClinicMemberSession } from "@/lib/auth/types";
import { verifyRealTimeAttendance } from "@/lib/firebase/callables";

const timeFormat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

/** Projektör QR'ındaki adres: `/attendance?s=<ders>&c=<kod>` (F4.3). Ders eşleşirse kod önceden doldurulur. */
function codeFromLink(sessionId: string): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("s") === sessionId ? (params.get("c") ?? "").toUpperCase().slice(0, ATTENDANCE_CODE_LENGTH) : "";
}

/**
 * Hekim yoklaması (F4.3 çekirdeği; kişisel geçmiş ve son dokunuşlar F4.4).
 * Canlı ders Firestore'dan dinlenir; kod MFA'lı oturumla SUNUCUDA doğrulanır (cihaz bağlama yok, D23) ve
 * ekrandaki "katıldınız" bilgisi kendi kaydı dinlenerek gösterilir (iyimser başarı yok).
 */
export function DoctorCheckIn({ session }: { session: ClinicMemberSession }) {
  const live = useLiveLecture();
  const lecture = live.status === "ready" && isLectureOpen(live.data) ? live.data : null;
  const record = useMyRecord(lecture?.id ?? null, session.uid);
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const checkIn = useAsyncAction((sessionId: string, value: string) =>
    verifyRealTimeAttendance({ sessionId, code: value.trim() })
  );

  useEffect(() => {
    if (!lecture) return;
    const fromLink = codeFromLink(lecture.id);
    if (fromLink) setCode(fromLink);
  }, [lecture]);

  if (live.status === "loading") return <p className="page-header-subtitle">Canlı ders kontrol ediliyor…</p>;
  if (live.status === "error") return <Alert tone="critical">{live.error}</Alert>;
  if (!lecture) {
    return (
      <Card title="Ders yoklaması">
        <EmptyState
          title="Şu anda açık ders yoklaması yok"
          description="Eğitim sorumlusu dersi başlattığında bu ekran kendiliğinden açılır."
        />
      </Card>
    );
  }

  const mine = record.status === "ready" ? record.data : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lecture) return;
    await checkIn.run(lecture.id, code);
  }

  return (
    <Card
      title={lecture.title}
      description={`${lecture.lecturer} · ${lecture.category}`}
      actions={
        <span className="ui-actions">
          <Countdown deadlineMs={lecture.endsAtMs} label="Yoklamanın kapanmasına kalan süre" warnAtSeconds={[60]} />
        </span>
      }
    >
      {mine?.status === "present" ? (
        <Alert tone="success" title="Yoklamanız alındı">
          {mine.verifiedAtMs ? `Saat ${timeFormat.format(mine.verifiedAtMs)} itibarıyla bu derse katıldınız.` : null}
        </Alert>
      ) : (
        <form className="auth-stack" onSubmit={onSubmit} noValidate>
          {mine?.status === "excused" && (
            <StatusChip tone="warning">Bu derste mazeretli olarak işaretlisiniz; katılırsanız güncellenir.</StatusChip>
          )}
          {checkIn.error && <Alert tone="critical">{checkIn.error}</Alert>}
          <Field label="Projektördeki kod" hint="Kod 15 saniyede bir yenilenir; ekrandaki güncel kodu girin." required>
            {(p) => (
              <input
                {...p}
                ref={codeRef}
                className="form-input mono-num totp-input"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={ATTENDANCE_CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              />
            )}
          </Field>
          <div className="ui-actions">
            <Button type="submit" loading={checkIn.pending} loadingText="Gönderiliyor…">
              Yoklamaya katıl
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
