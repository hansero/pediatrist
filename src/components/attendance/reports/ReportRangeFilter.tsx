"use client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { ReportRange } from "@/lib/attendance/reports";

/** Rapor tarih aralığı (başlangıç ve bitiş günü dahil). Raporlar canlı değildir; "Yenile" yeniden okur. */
export function ReportRangeFilter({
  range,
  onChange,
  onReload,
  error,
  reloading,
}: {
  range: ReportRange;
  onChange: (range: ReportRange) => void;
  onReload: () => void;
  error?: string;
  reloading?: boolean;
}) {
  return (
    <div className="report-filter">
      <Field label="Başlangıç">
        {(p) => (
          <input
            {...p}
            type="date"
            className="form-input"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
          />
        )}
      </Field>
      <Field label="Bitiş" error={error}>
        {(p) => (
          <input
            {...p}
            type="date"
            className="form-input"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
          />
        )}
      </Field>
      <Button
        variant="secondary"
        onClick={onReload}
        disabled={Boolean(error)}
        loading={reloading}
        loadingText="Yenileniyor…"
      >
        Yenile
      </Button>
    </div>
  );
}
