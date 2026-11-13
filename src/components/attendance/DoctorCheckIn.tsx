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
import { parseCheckInLink } from "@/lib/attendance/checkInLink";
import { isLectureOpen, useLiveLecture, useMyRecord } from "@/lib/attendance/live";
import type { ClinicMemberSession } from "@/lib/auth/types";
import { verifyRealTimeAttendance } from "@/lib/firebase/callables";
import { QrScanner } from "./QrScanner";

const timeFormat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

/**
 * Telefonun kendi kamerasıyla okutulan projektör QR'ı bu sayfayı `?s=<ders>&c=<kod>` ile açar (F4.3).
 * Ders eşleşirse kod önceden doldurulur; gönderim yine bir dokunuşla yapılır (adresle mutasyon yok).
 */
function codeFromLink(sessionId: string): string {
  if (typeof window === "undefined") return "";
  const link = parseCheckInLink(window.location.href, window.location.origin);
  return link.ok && link.sessionId === sessionId ? link.code : "";
}

/** Yoklama alındıktan sonra adresteki eski kodu temizler (yenilemede/geri tuşunda tekrar dolmasın). */
function clearLinkParams() {
  if (typeof window === "undefined" || !window.location.search) return;
  window.history.replaceState(window.history.state, "", window.location.pathname);
}

/**
 * Hekim yoklaması (F4.3 çekirdeği; kişisel geçmiş F4.4; uygulama içi QR okutma F11.2).
 * Canlı ders Firestore'dan dinlenir; kod MFA'lı oturumla SUNUCUDA doğrulanır (cihaz bağlama yok, D23) ve
 * ekrandaki "katıldınız" bilgisi kendi kaydı dinlenerek gösterilir (iyimser başarı yok).
 * İki yol: "QR kodu okut" (okununca hemen gönderilir) ya da projektördeki kodu elle girme.
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

  const lectureId = lecture?.id ?? null;
  useEffect(() => {
    if (!lectureId) return;
    const fromLink = codeFromLink(lectureId);
    if (fromLink) setCode(fromLink);
  }, [lectureId]);

  const present = record.status === "ready" && record.data?.status === "present";
  useEffect(() => {
    if (present) clearLinkParams();
  }, [present]);

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

  function onScanned(scanned: string) {
    if (!lecture) return;
    setCode(scanned);
    void checkIn.run(lecture.id, scanned);
  }

  return (
    <Card
      title={lecture.title}
      description={lecture.lecturer}
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
          <QrScanner sessionId={lecture.id} onCode={onScanned} disabled={checkIn.pending} />
          <p className="qr-scanner-divider" aria-hidden="true">
            veya kodu elle girin
          </p>
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
