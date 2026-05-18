import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned action slot (buttons, filters, etc.) */
  actions?: React.ReactNode;
  /** Optional left-side ornament (icon, badge) */
  icon?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, icon }) => (
  <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60 mb-6">
    <div className="flex items-start gap-3 min-w-0">
      {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold text-text-primary leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-[13px] text-text-muted mt-1">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);
