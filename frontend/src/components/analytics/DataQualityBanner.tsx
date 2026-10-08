'use client';

import React, { useState } from 'react';
import { AlertTriangle, Info, ChevronDown, ChevronUp, AlertCircle, ShieldAlert } from 'lucide-react';
import { PnlCompletenessModel, CompletenessStatus } from '@/lib/types';
import { formatINR } from '@/lib/format';

interface DataQualityBannerProps {
  completeness: PnlCompletenessModel;
  dataLimitations?: string[];
}

export const DataQualityBanner: React.FC<DataQualityBannerProps> = ({
  completeness,
  dataLimitations = []
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { completenessStatus } = completeness;

  if (completenessStatus === 'COMPLETE') {
    return null;
  }

  const isInsufficient = completenessStatus === 'INSUFFICIENT_DATA';

  return (
    <div
      className={`rounded-2xl border p-4.5 transition-all shadow-2xs font-sans ${
        isInsufficient
          ? 'bg-rose-50/70 border-rose-200 text-rose-950'
          : 'bg-amber-50/70 border-amber-200 text-amber-950'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-xl shrink-0 mt-0.5 ${
              isInsufficient ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isInsufficient ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm tracking-tight">
                {isInsufficient
                  ? 'Data Quality Notice: Insufficient Cost & Coverage Data'
                  : 'Data Quality Notice: Estimated / Partial Financial Data'}
              </h3>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isInsufficient
                    ? 'bg-rose-200 text-rose-800'
                    : 'bg-amber-200 text-amber-900'
                }`}
              >
                {isInsufficient ? 'Insufficient Data' : 'Partial / Estimated'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {isInsufficient
                ? 'This reporting period does not contain enough linked recipe consumption records to calculate an authoritative food cost or net profit. Results are indicative only.'
                : 'Certain bill items in this period lack active recipe definitions or historical inventory costs. Profitability calculations reflect available data with data gaps highlighted below.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-border/80 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <span>{isExpanded ? 'Hide Details' : 'View Audit Details'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Primary Highlights Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5 pt-3 border-t border-border/60">
        <div className="bg-white/80 p-2.5 rounded-xl border border-border/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Recipe Coverage
          </span>
          <span className="text-sm font-bold text-slate-800">
            {completeness.recipeCoveragePercent ? `${completeness.recipeCoveragePercent}%` : '—'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {completeness.coveredLines} of {completeness.totalBillLines} lines
          </span>
        </div>

        <div className="bg-white/80 p-2.5 rounded-xl border border-border/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Missing Recipes
          </span>
          <span className="text-sm font-bold text-amber-700">
            {completeness.missingRecipeLines} lines
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {formatINR(completeness.missingRecipeSalesAmount)} sales volume
          </span>
        </div>

        <div className="bg-white/80 p-2.5 rounded-xl border border-border/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Uncosted Items
          </span>
          <span className="text-sm font-bold text-amber-700">
            {completeness.missingCostLines} lines
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Missing cost history
          </span>
        </div>

        <div className="bg-white/80 p-2.5 rounded-xl border border-border/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Negative Stock Overrides
          </span>
          <span className="text-sm font-bold text-rose-700">
            {completeness.negativeStockExceptionCount} events
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Manual override audits
          </span>
        </div>
      </div>

      {/* Expandable Limitations Section */}
      {isExpanded && (
        <div className="mt-3.5 pt-3 border-t border-border/60 space-y-2 text-xs">
          <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500" /> System Limitations & Methodology Notes:
          </h4>
          <ul className="list-disc list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed">
            {dataLimitations && dataLimitations.length > 0 ? (
              dataLimitations.map((limitation, idx) => (
                <li key={idx} className="text-slate-600 font-medium">
                  {limitation}
                </li>
              ))
            ) : (
              <li className="text-slate-600 font-medium">
                Recipe coverage is based on active recipe versions configured at the time of sale. Unlinked sales reduce overall calculation completeness.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
