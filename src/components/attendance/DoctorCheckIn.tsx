"use client";

import React, { useReducer, useRef, useState } from "react";
import { ATTENDANCE_CODE_LENGTH, ATTENDANCE_SLOT_MS } from "@shared/constants";
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

/** Kod alanının ipucu: yenilenme aralığı ortak sabitten (D28). */
export const CODE_HINT = `Kod ${ATTENDANCE_SLOT_MS / 1000} saniyede bir yenilenir; ekrandaki güncel kodu girin.`;

/**
 * Hekim yoklaması (F4.3 çekirdeği; kişisel geçmiş F4.4).
 * Canlı ders Firestore'dan dinlenir; hekim projektördeki kodu ELLE girer (QR yok, D28) ve kod MFA'lı oturumla
 * SUNUCUDA doğrulanır (cihaz bağlama yok, D23). "Katıldınız" bilgisi kendi kaydı dinlenerek gösterilir
 * (iyimser başarı yok).
 */
export function DoctorCheckIn({ session }: { session: ClinicMemberSession }) {
  const live = useLiveLecture();
  const current = live.status === "ready" ? live.data : null;
  // Süre dolunca ekran yeniden değerlendirilir (F13.2): zamanlayıcı dersi en geç birkaç dakika içinde kapatır,
  // o arada form açık kalmaz. Geri sayım kendi state'ini tuttuğu için bu bileşen her saniye yeniden çizilmez.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const lecture = isLectureOpen(current) ? current : null;
  const record = useMyRecord(current?.id ?? null, session.uid);
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const checkIn = useAsyncAction((sessionId: string, value: string) =>
    verifyRealTimeAttendance({ sessionId, code: value.trim() })
  );

  if (live.status === "loading") return <p className="page-header-subtitle">Canlı ders kontrol ediliyor…</p>;
  if (live.status === "error") return <Alert tone="critical">{live.error}</Alert>;
  const mine = record.status === "ready" ? record.data : null;

  if (current && !lecture) {
    return (
      <Card title={current.title} description={current.lecturer}>
        <EmptyState
          title="Yoklama süresi doldu"
          description={
            mine?.status === "present"
              ? "Bu derse katılımınız kaydedildi."
              : "Bu dersin yoklaması kapandı; artık kod kabul edilmiyor."
          }
        />
      </Card>
    );
  }
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lecture) return;
    await checkIn.run(lecture.id, code);
  }

  return (
    <Card
      title={lecture.title}
      description={lecture.lecturer}
      actions={
        <span className="ui-actions">
          <Countdown
            deadlineMs={lecture.endsAtMs}
            label="Yoklamanın kapanmasına kalan süre"
            warnAtSeconds={[60]}
            onExpire={refresh}
          />
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
          <Field label="Projektördeki kod" hint={CODE_HINT} required>
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
