import React from 'react';
import { RecipeCoverageStatus } from '@/lib/types';
import { CheckCircle2, AlertTriangle, Ban } from 'lucide-react';

interface RecipeCoverageBadgeProps {
  status: RecipeCoverageStatus;
  className?: string;
  size?: 'sm' | 'md';
}

export const RecipeCoverageBadge: React.FC<RecipeCoverageBadgeProps> = ({
  status,
  className = '',
  size = 'sm'
}) => {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  if (status === 'UNAVAILABLE') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded bg-slate-100 text-slate-500 border border-slate-200 ${sizeClasses} ${className}`}
        title="Menu item is marked as unavailable"
      >
        <Ban className={iconSize} />
        <span>Unavailable</span>
      </span>
    );
  }

  if (status === 'COVERED') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses} ${className}`}
        title="Recipe is active and linked to this item (Informational)"
      >
        <CheckCircle2 className={iconSize} />
        <span>Covered</span>
      </span>
    );
  }

  // RECIPE_MISSING
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses} ${className}`}
      title="No active recipe linked. Sale will complete without recipe inventory consumption (Informational)"
    >
      <AlertTriangle className={iconSize} />
      <span>Recipe Missing</span>
    </span>
  );
};
