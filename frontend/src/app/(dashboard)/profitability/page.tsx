'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PnlResult } from '@/lib/types';
import { DateRangeFilter, getDefaultMonthRange, DateRange } from '@/components/analytics/DateRangeFilter';
import { DataQualityBanner } from '@/components/analytics/DataQualityBanner';
import { PnlKpiCard } from '@/components/analytics/PnlKpiCard';
import { BreakEvenCard } from '@/components/analytics/BreakEvenCard';
import { PnlWaterfallChart } from '@/components/analytics/PnlWaterfallChart';
import { PaymentSplitCard } from '@/components/analytics/PaymentSplitCard';
import { OperationalExceptionsCard } from '@/components/analytics/OperationalExceptionsCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import {
  TrendingUp, RefreshCw, AlertCircle, ShoppingBag, DollarSign,
  Receipt, Scale, Percent, CheckCircle2, ShieldAlert, AlertTriangle
} from 'lucide-react';

export default function ProfitabilityPage() {
  const { showToast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultMonthRange());
  const [pnlData, setPnlData] = useState<PnlResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPnl = useCallback(async (range: DateRange) => {
    try {
      setIsRefreshing(true);
      setError(null);
      const res = await api.getPnl(range.from, range.to);
      setPnlData(res);
    } catch (err: any) {
      const msg = err.message || 'Failed to load P&L financial data.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPnl(dateRange);
  }, [dateRange, fetchPnl]);

  const handleApplyRange = (newRange: DateRange) => {
    setDateRange(newRange);
  };

  const renderCompletenessBadge = (status: string) => {
    if (status === 'COMPLETE') {
      return (
        <Badge variant="success" className="px-2.5 py-1 text-xs font-semibold gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Complete
        </Badge>
      );
    }
    if (status === 'PARTIAL') {
      return (
        <Badge variant="warning" className="px-2.5 py-1 text-xs font-semibold gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Estimated / Partial
        </Badge>
      );
    }
    return (
      <Badge variant="danger" className="px-2.5 py-1 text-xs font-semibold gap-1.5">
        <ShieldAlert className="w-3.5 h-3.5" /> Insufficient Data
      </Badge>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight">
              Profitability & P&L Statement
            </h1>
            <span className="bg-amber-100 text-amber-900 border border-amber-300/80 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              Phase 3 CA Grade
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Authoritative income statement with historical recipe consumption, operating expenses, and audit completeness
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => fetchPnl(dateRange)}
            isLoading={isRefreshing}
            icon={<RefreshCw className="w-4 h-4 text-forest-800" />}
            className="border-border shadow-2xs"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range Picker */}
      <DateRangeFilter
        initialRange={dateRange}
        onApply={handleApplyRange}
        isLoading={isRefreshing}
      />

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      ) : error ? (
        /* Error State */
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-rose-900">Failed to load P&L Report</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchPnl(dateRange)}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      ) : pnlData ? (
        <div className="space-y-6">
          {/* Distinct Metrics Header: Overall Completeness vs Food Cost Coverage */}
          <div className="bg-white border border-border rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            {/* Metric A: Overall Data Completeness */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Overall Data Completeness:
              </span>
              {renderCompletenessBadge(pnlData.completeness.completenessStatus)}
            </div>

            {/* Metric B: Food Cost Recipe Coverage */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-500">
                Food Cost Recipe Coverage:
              </span>
              <strong className="text-forest-800 text-sm">
                {pnlData.completeness.recipeCoveragePercent ? `${pnlData.completeness.recipeCoveragePercent}%` : '—'}
              </strong>
              <span className="text-slate-400">
                ({pnlData.completeness.coveredLines} of {pnlData.completeness.totalBillLines} bill lines covered)
              </span>
            </div>
          </div>

          {/* Data Quality Banner (if PARTIAL or INSUFFICIENT_DATA) */}
          <DataQualityBanner
            completeness={pnlData.completeness}
            dataLimitations={pnlData.dataLimitations}
          />

          {/* Executive KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Gross Revenue */}
            <PnlKpiCard
              title="Gross Revenue"
              value={pnlData.grossRevenue}
              subtitle={`${pnlData.billCount} completed bills`}
              tooltip="Total sales recorded on all customer bills before deductions."
              icon={<ShoppingBag className="w-4 h-4" />}
            />

            {/* 2. Net Sales */}
            <PnlKpiCard
              title="Net Sales"
              value={pnlData.netSales}
              subtitle="After discounts & GST"
              tooltip="Gross Revenue minus total discounts and taxes retained by government."
              icon={<DollarSign className="w-4 h-4" />}
              valueClassName="text-forest-800"
            />

            {/* 3. Food Cost (COGS) */}
            <PnlKpiCard
              title="Food Cost (COGS)"
              value={pnlData.foodCost}
              subtitle={pnlData.foodCostPercent ? `${pnlData.foodCostPercent}% of Net Sales` : 'Cost ratio unavailable'}
              tooltip="Cost of raw materials consumed in fulfilled orders based on moving average unit cost."
              icon={<Receipt className="w-4 h-4" />}
              valueClassName="text-amber-800"
            />

            {/* 4. Food Cost % */}
            <PnlKpiCard
              title="Food Cost %"
              value={pnlData.foodCostPercent ? `${pnlData.foodCostPercent}%` : null}
              isCurrency={false}
              subtitle="Target ratio: 25% – 35%"
              tooltip="Food Cost divided by Net Sales. Authoritative ratio returned by server."
              icon={<Percent className="w-4 h-4" />}
              valueClassName="text-amber-700"
            />

            {/* 5. Gross Profit */}
            <PnlKpiCard
              title="Gross Profit"
              value={pnlData.grossProfit}
              subtitle="Net Sales minus Food Cost"
              tooltip="Profit remaining after deducting ingredient food costs."
              icon={<TrendingUp className="w-4 h-4" />}
              valueClassName="text-teal-800"
            />

            {/* 6. Gross Margin % (Strictly Unavailable - No Client Calculation) */}
            <PnlKpiCard
              title="Gross Margin %"
              value={null}
              isCurrency={false}
              isUnavailable={true}
              subtitle="Unavailable (not provided by server)"
              tooltip="Authoritative Gross Margin % is not provided by the server. In accordance with financial audit rules, margin percentages are not calculated in the browser."
              icon={<Percent className="w-4 h-4" />}
            />

            {/* 7. Operating Expenses */}
            <PnlKpiCard
              title="Operating Expenses"
              value={pnlData.operatingExpenses}
              subtitle="Overhead, rent & active expenses"
              tooltip="All active non-voided operating expenses recorded in this period."
              icon={<Receipt className="w-4 h-4" />}
              valueClassName="text-slate-800"
            />

            {/* 8. Configured Wastage Expense */}
            <PnlKpiCard
              title="Configured Wastage Impact"
              value={null}
              isUnavailable={true}
              badgeText="Not Configured"
              badgeVariant="neutral"
              subtitle="Physical tracking only"
              tooltip="The frozen schema contains no authoritative monetary wastage costing rules. Tracked purely as physical quantity deltas."
              icon={<ShieldAlert className="w-4 h-4" />}
            />

            {/* 9. Net Profit */}
            <PnlKpiCard
              title="Net Profit"
              value={pnlData.netProfit}
              subtitle="Gross Profit minus OpEx"
              tooltip="Operating profit after deducting food cost and recorded operating expenses."
              icon={<TrendingUp className="w-4 h-4" />}
              valueClassName={Number(pnlData.netProfit) >= 0 ? 'text-forest-900' : 'text-rose-700'}
            />

            {/* 10. Net Margin % (Strictly Unavailable - No Client Calculation) */}
            <PnlKpiCard
              title="Net Margin %"
              value={null}
              isCurrency={false}
              isUnavailable={true}
              subtitle="Unavailable (not provided by server)"
              tooltip="Authoritative Net Margin % is not provided by the server. In accordance with financial audit rules, margin percentages are not calculated in the browser."
              icon={<Percent className="w-4 h-4" />}
            />

            {/* 11 & 12. Break-Even Card */}
            <div className="sm:col-span-2">
              <BreakEvenCard breakEven={pnlData.breakEven} />
            </div>
          </div>

          {/* Financial Waterfall Visualizer */}
          <PnlWaterfallChart
            grossRevenue={pnlData.grossRevenue}
            totalDiscounts={pnlData.totalDiscounts}
            totalTax={pnlData.totalTax}
            netSales={pnlData.netSales}
            foodCost={pnlData.foodCost}
            grossProfit={pnlData.grossProfit}
            operatingExpenses={pnlData.operatingExpenses}
            netProfit={pnlData.netProfit}
          />

          {/* Secondary Audit Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PaymentSplitCard splits={pnlData.paymentSplits} />
            <OperationalExceptionsCard
              exceptions={{
                missingRecipeLines: pnlData.completeness.missingRecipeLines,
                missingCostLines: pnlData.completeness.missingCostLines,
                negativeStockOverrideBills: pnlData.completeness.negativeStockExceptionCount,
                voidedBillCount: 0
              }}
              wastageIndicators={pnlData.wastageIndicators}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
