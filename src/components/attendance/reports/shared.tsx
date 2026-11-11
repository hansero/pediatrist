import type { AttendanceStatus } from "@shared/types";
import { StatusChip } from "@/components/ui/StatusChip";
import { isBelowThreshold, STATUS_LABEL } from "@/lib/attendance/reports";

const percent = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });

export const formatRate = (rate: number | null) => (rate === null ? "—" : percent.format(rate));

/** Katılım durumu çipi (raporlarda ortak dil: Katıldı / Mazeretli / Katılmadı). */
export function StatusCell({ status }: { status: AttendanceStatus }) {
  const tone = status === "present" ? "success" : status === "excused" ? "warning" : "critical";
  return <StatusChip tone={tone}>{STATUS_LABEL[status]}</StatusChip>;
}

/** Oran ve eşik altıysa metinle uyarı (renk tek başına anlam taşımaz, WCAG 1.4.1). */
export function RateValue({ rate }: { rate: number | null }) {
  return (
    <span className="report-rate">
      <span className="mono-num">{formatRate(rate)}</span>
      {isBelowThreshold(rate) && <StatusChip tone="critical">Eşik altında</StatusChip>}
    </span>
  );
}
