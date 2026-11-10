import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

/** Veri yokken gösterilen dürüst boş durum (uydurma örnek veri yerine). */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      <p className="ui-empty-title">{title}</p>
      {description && <p className="page-header-subtitle">{description}</p>}
      {action && <div className="ui-actions">{action}</div>}
    </div>
  );
}
