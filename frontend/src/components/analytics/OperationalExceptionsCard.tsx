'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { AlertCircle, FileX, ShieldAlert, Trash2, Sliders } from 'lucide-react';
import { WastageIndicators } from '@/lib/types';

interface OperationalExceptionsCardProps {
  exceptions?: {
    missingRecipeLines: number;
    missingCostLines: number;
    negativeStockOverrideBills: number;
    voidedBillCount: number;
  };
  wastageIndicators?: WastageIndicators;
}

export const OperationalExceptionsCard: React.FC<OperationalExceptionsCardProps> = ({
  exceptions,
  wastageIndicators
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-sans">
      {/* Exceptions Panel */}
      {exceptions && (
        <Card className="p-5 border-border bg-white shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                Operational Exception Audits
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Billing anomalies & inventory overrides recorded in this period
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Missing Recipe Lines
              </span>
              <span className={`text-xl font-bold ${exceptions.missingRecipeLines > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                {exceptions.missingRecipeLines}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Sold without active recipe
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Uncosted Bill Lines
              </span>
              <span className={`text-xl font-bold ${exceptions.missingCostLines > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                {exceptions.missingCostLines}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Missing cost history
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Negative Stock Overrides
              </span>
              <span className={`text-xl font-bold ${exceptions.negativeStockOverrideBills > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                {exceptions.negativeStockOverrideBills}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Negative stock warnings overridden
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Voided Bills
              </span>
              <span className={`text-xl font-bold ${exceptions.voidedBillCount > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                {exceptions.voidedBillCount}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Transactions cancelled
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Wastage Physical Indicators */}
      {wastageIndicators && (
        <Card className="p-5 border-border bg-white shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-800">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                Physical Wastage & Inventory Deficits
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Physical quantities spoiled or corrected during stock checks
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Wastage Events
              </span>
              <span className="text-xl font-bold text-slate-800">
                {wastageIndicators.wastageCount}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {wastageIndicators.wastageQuantity} units recorded loss
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Count Deficit Events
              </span>
              <span className="text-xl font-bold text-slate-800">
                {wastageIndicators.countCorrectionDeficitCount}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {wastageIndicators.countCorrectionDeficitQuantity} units physical deficit
              </span>
            </div>

            <div className="col-span-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              <strong>Notice:</strong> Wastage and physical deficits are tracked purely as physical quantity deltas. Monetary expense impact is unconfigured in the frozen schema.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
