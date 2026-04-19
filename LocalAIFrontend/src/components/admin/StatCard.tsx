import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'accent' | 'success' | 'warning' | 'danger';
  sub?: string;
}

const colorMap = {
  accent:  { bg: 'bg-accent/15',   text: 'text-accent' },
  success: { bg: 'bg-success/15',  text: 'text-success' },
  warning: { bg: 'bg-warning/15',  text: 'text-warning' },
  danger:  { bg: 'bg-danger/15',   text: 'text-danger' },
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, color = 'accent', sub }) => {
  const c = colorMap[color];
  return (
    <div className="bg-elevated border border-border rounded-xl p-4 flex items-center gap-4 animate-fade-in">
      <div className={`p-2.5 rounded-lg ${c.bg} flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-text-muted uppercase tracking-wide font-medium">{label}</p>
        <p className="text-[22px] font-bold text-text-primary leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};
