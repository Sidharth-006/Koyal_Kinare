'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Calendar, RotateCcw, Check } from 'lucide-react';
import { formatDate } from '@/lib/format';

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangeFilterProps {
  initialRange: DateRange;
  onApply: (range: DateRange) => void;
  isLoading?: boolean;
}

export function getDefaultMonthRange(): DateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${day}`
  };
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  initialRange,
  onApply,
  isLoading = false
}) => {
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (preset: 'TODAY' | 'YESTERDAY' | 'LAST7' | 'THIS_MONTH' | 'LAST_MONTH') => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    let newFrom = todayStr;
    let newTo = todayStr;

    if (preset === 'TODAY') {
      newFrom = todayStr;
      newTo = todayStr;
    } else if (preset === 'YESTERDAY') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      newFrom = yStr;
      newTo = yStr;
    } else if (preset === 'LAST7') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      newFrom = past.toISOString().slice(0, 10);
      newTo = todayStr;
    } else if (preset === 'THIS_MONTH') {
      const def = getDefaultMonthRange();
      newFrom = def.from;
      newTo = def.to;
    } else if (preset === 'LAST_MONTH') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      newFrom = firstDayLastMonth.toISOString().slice(0, 10);
      newTo = lastDayLastMonth.toISOString().slice(0, 10);
    }

    setFrom(newFrom);
    setTo(newTo);
    setError(null);
    onApply({ from: newFrom, to: newTo });
  };

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!from || !to) {
      setError('Please provide both start date and end date.');
      return;
    }
    if (from > to) {
      setError('Start date cannot be after end date.');
      return;
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
      setError('Selected range cannot exceed 366 days.');
      return;
    }

    setError(null);
    onApply({ from, to });
  };

  const handleReset = () => {
    const def = getDefaultMonthRange();
    setFrom(def.from);
    setTo(def.to);
    setError(null);
    onApply(def);
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-4 shadow-2xs space-y-3 font-sans">
      {/* Quick Presets Bar */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-border-subtle">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-forest-700" /> Presets:
        </span>
        <button
          type="button"
          onClick={() => applyPreset('TODAY')}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cream-100/70 text-forest-800 hover:bg-forest-800 hover:text-white transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => applyPreset('YESTERDAY')}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cream-100/70 text-forest-800 hover:bg-forest-800 hover:text-white transition-colors"
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={() => applyPreset('LAST7')}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cream-100/70 text-forest-800 hover:bg-forest-800 hover:text-white transition-colors"
        >
          Last 7 Days
        </button>
        <button
          type="button"
          onClick={() => applyPreset('THIS_MONTH')}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cream-100/70 text-forest-800 hover:bg-forest-800 hover:text-white transition-colors"
        >
          This Month
        </button>
        <button
          type="button"
          onClick={() => applyPreset('LAST_MONTH')}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cream-100/70 text-forest-800 hover:bg-forest-800 hover:text-white transition-colors"
        >
          Last Month
        </button>
      </div>

      {/* Date Inputs & Action Buttons */}
      <form onSubmit={handleApply} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Start Date
          </label>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setError(null);
            }}
            className="font-semibold text-forest-800 w-full min-h-[42px]"
          />
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            End Date
          </label>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setError(null);
            }}
            className="font-semibold text-forest-800 w-full min-h-[42px]"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            icon={<Check className="w-4 h-4" />}
            className="min-h-[42px] px-5"
          >
            Apply
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleReset}
            disabled={isLoading}
            icon={<RotateCcw className="w-4 h-4 text-slate-500" />}
            className="min-h-[42px] text-slate-600 hover:text-slate-900"
          >
            Reset
          </Button>
        </div>
      </form>

      {/* Inline Client Validation Error */}
      {error && (
        <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
          {error}
        </div>
      )}

      {/* Current Range Summary */}
      <div className="text-[11px] text-slate-500 font-medium">
        Active Period: <strong className="text-forest-800">{formatDate(initialRange.from)}</strong> to <strong className="text-forest-800">{formatDate(initialRange.to)}</strong>
      </div>
    </div>
  );
};
