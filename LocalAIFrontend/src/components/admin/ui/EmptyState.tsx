import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, compact }) => (
  <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8 px-4' : 'py-14 px-6'}`}>
    {Icon && (
      <div className="w-12 h-12 rounded-2xl bg-elevated border border-border flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-text-muted" />
      </div>
    )}
    <p className="text-[14px] font-semibold text-text-primary">{title}</p>
    {description && <p className="text-[12px] text-text-muted mt-1 max-w-md">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
