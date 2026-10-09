'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface RevisionUpdateBannerProps {
  show: boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export const RevisionUpdateBanner: React.FC<RevisionUpdateBannerProps> = ({
  show,
  onRefresh,
  isRefreshing = false,
  className = ''
}) => {
  if (!show) return null;

  return (
    <div
      role="alert"
      className={`p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between gap-4 text-amber-950 shadow-sm animate-slide-up ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
        <span className="text-sm font-bold tracking-tight truncate">
          Data updated elsewhere — Refresh
        </span>
      </div>

      <Button
        type="button"
        variant="warning"
        size="sm"
        onClick={onRefresh}
        isLoading={isRefreshing}
        disabled={isRefreshing}
        icon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
        className="shrink-0 text-xs font-semibold min-h-[38px]"
      >
        Refresh
      </Button>
    </div>
  );
};
