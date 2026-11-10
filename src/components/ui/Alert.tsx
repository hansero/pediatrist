import type { ReactNode } from "react";
import { cx, type Tone } from "./cx";

export interface AlertProps {
  tone: Tone;
  title?: ReactNode;
  children?: ReactNode;
  /** Verilirse "Kapat" düğmesi gösterilir. */
  onDismiss?: () => void;
  className?: string;
  id?: string;
}

/**
 * Satır içi uyarı. `critical` → `role="alert"` (hemen duyurulur); diğerleri → `role="status"` (kibar).
 * Renk tek başına anlam taşımaz: başlık/metin durumu söyler (WCAG 1.4.1).
 */
export function Alert({ tone, title, children, onDismiss, className, id }: AlertProps) {
  return (
    <div
      id={id}
      role={tone === "critical" ? "alert" : "status"}
      className={cx("clinical-alert", "ui-alert", tone, className)}
    >
      <div className="clinical-alert-body">
        {title && <strong className="clinical-alert-title">{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" className="ui-icon-btn" aria-label="Uyarıyı kapat" onClick={onDismiss}>
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}
