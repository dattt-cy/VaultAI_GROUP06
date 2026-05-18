import React from 'react';
import { cn } from '../../../lib/utils';

interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, rounded = 'md' }) => {
  const radius = {
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  }[rounded];
  return (
    <div
      role="status"
      aria-label="Đang tải"
      className={cn('bg-border/40 animate-pulse', radius, className)}
    />
  );
};

export const SkeletonStatCard: React.FC = () => (
  <div className="bg-elevated border border-border rounded-xl p-4 flex items-center gap-4">
    <Skeleton className="w-10 h-10" rounded="lg" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-5 w-16" />
    </div>
  </div>
);

export const SkeletonPanel: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="bg-elevated border border-border rounded-xl p-4 space-y-3">
    <Skeleton className="h-4 w-32" />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-10" />
      </div>
    ))}
  </div>
);
