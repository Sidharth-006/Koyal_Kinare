import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { RecipeStatus, RecipeVersionStatus } from '@/lib/types';
import { AlertCircle, CheckCircle2, Clock, Ban } from 'lucide-react';

interface RecipeStatusBadgeProps {
  status?: RecipeStatus | null;
  hasActiveRecipe?: boolean;
  className?: string;
}

export const RecipeStatusBadge: React.FC<RecipeStatusBadgeProps> = ({
  status,
  hasActiveRecipe,
  className
}) => {
  if (!hasActiveRecipe || status === null || status === undefined) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100/90 text-amber-900 border border-amber-300 shadow-2xs ${className || ''}`}
        data-testid="recipe-missing-badge"
      >
        <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>Recipe Missing</span>
      </span>
    );
  }

  if (status === 'ACTIVE') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs ${className || ''}`}
        data-testid="recipe-active-badge"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Active Recipe</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs ${className || ''}`}
      data-testid="recipe-inactive-badge"
    >
      <Ban className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <span>Inactive</span>
    </span>
  );
};

interface VersionStatusBadgeProps {
  status: RecipeVersionStatus;
  className?: string;
}

export const VersionStatusBadge: React.FC<VersionStatusBadgeProps> = ({
  status,
  className
}) => {
  switch (status) {
    case 'ACTIVE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 ${className || ''}`}
          data-testid="version-status-active"
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Active</span>
        </span>
      );
    case 'DRAFT':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 ${className || ''}`}
          data-testid="version-status-draft"
        >
          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Draft</span>
        </span>
      );
    case 'SUPERSEDED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 ${className || ''}`}
          data-testid="version-status-superseded"
        >
          <span>Superseded</span>
        </span>
      );
    case 'INACTIVE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 ${className || ''}`}
          data-testid="version-status-inactive"
        >
          <span>Inactive</span>
        </span>
      );
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};
