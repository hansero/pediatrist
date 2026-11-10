import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: ReactNode;
  /** Kısa açıklama: kullanıcının bu sayfada ne yapabileceği (teknik ayrıntı değil). */
  description?: ReactNode;
  actions?: ReactNode;
}

/** Sayfanın tek `h1`'i. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="page-header-subtitle">{description}</p>}
      </div>
      {actions && <div className="ui-actions">{actions}</div>}
    </header>
  );
}
