"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import type { LiveState } from "@/hooks/useFirestoreSnapshot";

export interface StepAction {
  href: string;
  label: string;
}

/**
 * Ana kart (F7.3): şu anki durum ve TEK birincil eylem. İkincil bağlantılar yalnızca bekleyen iş yokken
 * (kullanıcıyı boş bir kartta bırakmamak için) gösterilir.
 */
export function NextStepCard({
  title,
  description,
  action,
  secondary = [],
  loading,
}: {
  title: string;
  description: ReactNode;
  action?: StepAction;
  secondary?: StepAction[];
  loading?: boolean;
}) {
  return (
    <Card
      title={loading ? "Durum kontrol ediliyor…" : title}
      className="next-step"
      description={loading ? undefined : description}
    >
      {!loading && (action || secondary.length > 0) && (
        <div className="ui-actions">
          {action && (
            <Link href={action.href} className="btn btn-primary">
              {action.label}
            </Link>
          )}
          {secondary.map((s) => (
            <Link key={s.href} href={s.href} className="btn btn-secondary">
              {s.label}
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

export interface KpiProps {
  label: string;
  /** Sunucu sayımının durumu; yükleniyor/hatalıyken değer gösterilmez. */
  state: Pick<LiveState<unknown>, "status" | "error">;
  value: ReactNode;
  foot: ReactNode;
  warning?: ReactNode;
}

/** Gösterge kutusu: değer yalnızca sunucu yanıtından sonra; hata Türkçe ve kutunun içinde. */
export function Kpi({ label, state, value, foot, warning }: KpiProps) {
  return (
    <div className="metric-card" aria-busy={state.status === "loading" || undefined}>
      <dt className="metric-label">{label}</dt>
      <dd className="metric-value mono-num">{state.status === "ready" ? value : "—"}</dd>
      <dd className="metric-foot">
        {state.status === "loading" ? "Hesaplanıyor…" : state.status === "error" ? state.error : foot}
      </dd>
      {state.status === "ready" && warning && <dd className="metric-warning">{warning}</dd>}
    </div>
  );
}

export const percent = (rate: number | null) => (rate === null ? "—" : `%${Math.round(rate * 100)}`);

const timeFormat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
export const clock = (msValue: number) => timeFormat.format(msValue);
export const dateTime = (msValue: number) => dateTimeFormat.format(msValue);

/** Durum değişimini (ders bitişi, sınav süresi) yeniden değerlendirmek için 30 saniyelik saat. */
export function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
