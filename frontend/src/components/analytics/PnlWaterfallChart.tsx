'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { formatINR } from '@/lib/format';
import { ArrowDown, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PnlWaterfallChartProps {
  grossRevenue: string;
  totalDiscounts: string;
  totalTax: string;
  netSales: string;
  foodCost: string;
  grossProfit: string;
  operatingExpenses: string;
  netProfit: string;
}

export const PnlWaterfallChart: React.FC<PnlWaterfallChartProps> = ({
  grossRevenue,
  totalDiscounts,
  totalTax,
  netSales,
  foodCost,
  grossProfit,
  operatingExpenses,
  netProfit
}) => {
  const numGross = Math.max(Number(grossRevenue) || 0, 1);
  const numDiscounts = Number(totalDiscounts) || 0;
  const numTax = Number(totalTax) || 0;
  const numNetSales = Number(netSales) || 0;
  const numFoodCost = Number(foodCost) || 0;
  const numGrossProfit = Number(grossProfit) || 0;
  const numOpEx = Number(operatingExpenses) || 0;
  const numNetProfit = Number(netProfit) || 0;

  const steps = [
    {
      label: 'Gross Revenue',
      value: numGross,
      formatted: formatINR(grossRevenue),
      type: 'base',
      color: 'bg-forest-800 text-white',
      barColor: 'bg-forest-700',
      description: 'Total billed order value'
    },
    {
      label: 'Discounts & Taxes',
      value: numDiscounts + numTax,
      formatted: `-${formatINR(numDiscounts + numTax)}`,
      type: 'deduction',
      color: 'bg-amber-100 text-amber-900',
      barColor: 'bg-amber-500',
      description: `Discounts (${formatINR(totalDiscounts)}) + Tax (${formatINR(totalTax)})`
    },
    {
      label: 'Net Sales',
      value: numNetSales,
      formatted: formatINR(netSales),
      type: 'subtotal',
      color: 'bg-emerald-100 text-emerald-950 font-bold',
      barColor: 'bg-emerald-600',
      description: 'Revenue retained by cafe'
    },
    {
      label: 'Food Cost (COGS)',
      value: numFoodCost,
      formatted: `-${formatINR(foodCost)}`,
      type: 'deduction',
      color: 'bg-rose-100 text-rose-950',
      barColor: 'bg-rose-500',
      description: 'Ingredients consumed in completed bills'
    },
    {
      label: 'Gross Profit',
      value: numGrossProfit,
      formatted: formatINR(grossProfit),
      type: 'subtotal',
      color: 'bg-teal-100 text-teal-950 font-bold',
      barColor: 'bg-teal-600',
      description: 'Net sales minus food cost'
    },
    {
      label: 'Operating Expenses',
      value: numOpEx,
      formatted: `-${formatINR(operatingExpenses)}`,
      type: 'deduction',
      color: 'bg-slate-200 text-slate-800',
      barColor: 'bg-slate-500',
      description: 'Recorded operating & maintenance costs'
    },
    {
      label: 'Net Profit',
      value: numNetProfit,
      formatted: formatINR(netProfit),
      type: 'final',
      color: numNetProfit >= 0 ? 'bg-forest-900 text-amber-300 font-bold' : 'bg-rose-900 text-rose-200 font-bold',
      barColor: numNetProfit >= 0 ? 'bg-forest-800' : 'bg-rose-700',
      description: 'Final available net operating profit'
    }
  ];

  return (
    <Card className="p-5 sm:p-6 border-border bg-white shadow-2xs font-sans space-y-5">
      <div>
        <h3 className="font-serif text-lg font-bold text-forest-800 tracking-tight">
          Financial Waterfall Breakdown
        </h3>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Step-by-step margin reconciliation from Gross Revenue to Net Operating Profit
        </p>
      </div>

      {/* Waterfall Visual Bars */}
      <div className="space-y-3.5">
        {steps.map((step, idx) => {
          const widthPct = Math.min(Math.max((Math.abs(step.value) / numGross) * 100, 4), 100);

          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  {step.type === 'deduction' && <Minus className="w-3 h-3 text-rose-500" />}
                  {step.type === 'subtotal' && <ArrowRight className="w-3 h-3 text-emerald-600" />}
                  {step.type === 'final' && <TrendingUp className="w-3 h-3 text-amber-500" />}
                  <span>{step.label}</span>
                </span>
                <span className="tabular-nums font-bold text-slate-900">
                  {step.formatted}
                </span>
              </div>

              {/* Progress Bar Container */}
              <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex items-center p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${step.barColor}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>

              <div className="text-[10px] text-slate-400 font-medium pl-1">
                {step.description}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
