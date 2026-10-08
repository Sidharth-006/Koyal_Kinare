'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Info } from 'lucide-react';
import { formatINR } from '@/lib/format';

interface PnlKpiCardProps {
  title: string;
  value: string | number | null;
  isCurrency?: boolean;
  subtitle?: string | null;
  tooltip?: string;
  badgeText?: string;
  badgeVariant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'forest';
  valueClassName?: string;
  isUnavailable?: boolean;
  icon?: React.ReactNode;
}

export const PnlKpiCard: React.FC<PnlKpiCardProps> = ({
  title,
  value,
  isCurrency = true,
  subtitle,
  tooltip,
  badgeText,
  badgeVariant = 'neutral',
  valueClassName,
  isUnavailable = false,
  icon
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const renderValue = () => {
    if (isUnavailable || value === null || value === undefined || value === '') {
      return isCurrency ? '₹—' : '—';
    }
    if (isCurrency) {
      return formatINR(value);
    }
    return String(value);
  };

  return (
    <Card className="p-4 sm:p-5 relative border-border bg-white shadow-2xs hover:shadow-card transition-shadow flex flex-col justify-between min-h-[128px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          {tooltip && (
            <div className="relative inline-block">
              <button
                type="button"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(!showTooltip)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none p-0.5 rounded"
                aria-label="Info"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {showTooltip && (
                <div className="absolute left-0 bottom-full mb-1.5 z-30 w-56 p-2 bg-slate-900 text-white text-[11px] font-normal rounded-xl shadow-lg leading-relaxed pointer-events-none">
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {badgeText && (
            <Badge variant={badgeVariant} className="text-[10px] px-2 py-0.5">
              {badgeText}
            </Badge>
          )}
          {icon && <div className="text-forest-700/80">{icon}</div>}
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <div
          className={`font-serif text-2xl sm:text-3xl font-bold tracking-tight ${
            valueClassName || 'text-slate-800'
          }`}
        >
          {renderValue()}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 font-medium leading-relaxed truncate">
            {subtitle}
          </p>
        )}
      </div>
    </Card>
  );
};
