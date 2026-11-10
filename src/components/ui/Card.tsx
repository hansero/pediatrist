import { useId, type ReactNode } from "react";
import { cx } from "./cx";

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Başlığın sağındaki eylemler. */
  actions?: ReactNode;
  /** Sayfa yapısına göre başlık düzeyi (varsayılan h2). */
  headingLevel?: 2 | 3;
  children?: ReactNode;
  className?: string;
}

/** Başlıklı yüzey. Başlık varsa bölge başlıkla etiketlenir (`aria-labelledby`). */
export function Card({ title, description, actions, headingLevel = 2, children, className }: CardProps) {
  const titleId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={cx("surface-card", className)} aria-labelledby={title ? titleId : undefined}>
      {(title || actions) && (
        <div className="ui-card-header">
          <div>
            {title && <Heading id={titleId}>{title}</Heading>}
            {description && <p className="page-header-subtitle">{description}</p>}
          </div>
          {actions && <div className="ui-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
