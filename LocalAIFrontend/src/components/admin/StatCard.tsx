import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
  sub?: string;
  /** Percent change vs previous period; positive = up, negative = down, 0 = flat. */
  trend?: number;
  /** Override the "vs previous" text (e.g. "so với 7 ngày trước") */
  trendLabel?: string;
  /** Whether positive trend is good (default) or bad (e.g. error counts) */
  invertTrend?: boolean;
  onClick?: () => void;
}

const colorMap = {
  accent:  { bg: 'bg-accent/12',  text: 'text-accent'  },
  success: { bg: 'bg-success/12', text: 'text-success' },
  warning: { bg: 'bg-warning/12', text: 'text-warning' },
  danger:  { bg: 'bg-danger/12',  text: 'text-danger'  },
  neutral: { bg: 'bg-border/40',  text: 'text-text-secondary' },
};

const formatValue = (v: string | number) =>
  typeof v === 'number' ? v.toLocaleString('vi-VN') : v;

export const StatCard: React.FC<StatCardProps> = ({
  label, value, icon: Icon, color = 'neutral', sub,
  trend, trendLabel, invertTrend, onClick,
}) => {
  const c = colorMap[color];

  const trendDirection = trend == null
    ? null
    : trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';

  const trendGood =
    trendDirection === 'flat' ? null :
    trendDirection === 'up' ? !invertTrend : invertTrend;

  const TrendIcon =
    trendDirection === 'up' ? TrendingUp :
    trendDirection === 'down' ? TrendingDown : Minus;

  const trendColor =
    trendDirection == null ? '' :
    trendGood === null ? 'text-text-muted' :
    trendGood ? 'text-success' : 'text-danger';

  const Wrapper: React.ElementType = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`group bg-elevated border border-border rounded-xl p-4 text-left transition-all duration-200 animate-fade-in
        ${onClick ? 'cursor-pointer hover:border-border/80 hover:shadow-md hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`p-2 rounded-lg ${c.bg} flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
        {trendDirection != null && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${trendColor} tabular-nums`}>
            <TrendIcon className="w-3 h-3" />
            {trendDirection === 'flat' ? '0%' : `${trend! > 0 ? '+' : ''}${trend}%`}
          </span>
        )}
      </div>
      <p className="text-[11px] text-text-muted uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className="text-[24px] font-bold text-text-primary leading-tight tabular-nums">{formatValue(value)}</p>
      {(sub || trendLabel) && (
        <p className="text-[11px] text-text-muted mt-1.5 truncate">{trendLabel ?? sub}</p>
      )}
    </Wrapper>
  );
};
