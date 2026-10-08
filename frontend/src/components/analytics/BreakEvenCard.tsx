'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Scale, Info } from 'lucide-react';
import { BreakEvenResult } from '@/lib/types';
import { formatINR } from '@/lib/format';

interface BreakEvenCardProps {
  breakEven: BreakEvenResult;
}

export const BreakEvenCard: React.FC<BreakEvenCardProps> = ({ breakEven }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isAvailable = breakEven.breakEvenAmount !== null && breakEven.breakEvenAmount !== undefined;

  return (
    <Card className="p-4 sm:p-5 border-border bg-white shadow-2xs hover:shadow-card transition-shadow flex flex-col justify-between min-h-[128px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Break-Even Sales Target
          </span>
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
              <div className="absolute left-0 bottom-full mb-1.5 z-30 w-64 p-2.5 bg-slate-900 text-white text-[11px] font-normal rounded-xl shadow-lg leading-relaxed pointer-events-none">
                {breakEven.message ||
                  'Break-even represents the minimum revenue required to cover fixed operating costs based on target gross margin rate. It is not calculated when fixed costs are unconfigured.'}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={isAvailable ? 'success' : 'neutral'} className="text-[10px] px-2 py-0.5">
            {isAvailable ? 'Calculated' : 'Not Configured'}
          </Badge>
          <Scale className="w-4 h-4 text-forest-700/80" />
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <div className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-slate-800">
          {isAvailable ? formatINR(breakEven.breakEvenAmount!) : '₹—'}
        </div>

        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          {isAvailable ? (
            <span>
              Based on target margin rate of {breakEven.targetGrossMarginRate ? `${(Number(breakEven.targetGrossMarginRate) * 100).toFixed(1)}%` : '—'}
            </span>
          ) : (
            <span>
              Fixed costs not configured in system. Operating expenses are not assumed to be fixed.
            </span>
          )}
        </p>
      </div>
    </Card>
  );
};
