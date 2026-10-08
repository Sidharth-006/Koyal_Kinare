'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  AnalyticsOverviewResult,
  MenuPerformanceResult,
  MenuPerformanceSortKey
} from '@/lib/types';
import { DateRangeFilter, getDefaultMonthRange, DateRange } from '@/components/analytics/DateRangeFilter';
import { PaymentSplitCard } from '@/components/analytics/PaymentSplitCard';
import { OperationalExceptionsCard } from '@/components/analytics/OperationalExceptionsCard';
import { MenuPerformanceTable } from '@/components/analytics/MenuPerformanceTable';
import { PnlKpiCard } from '@/components/analytics/PnlKpiCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import { formatINR } from '@/lib/format';
import {
  BarChart3, RefreshCw, AlertCircle, ShoppingBag, UtensilsCrossed,
  Receipt, CheckCircle2, ShieldAlert, AlertTriangle, TrendingUp, DollarSign
} from 'lucide-react';

export default function AnalyticsPage() {
  const { showToast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultMonthRange());
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MENU_PERFORMANCE'>('OVERVIEW');

  // Overview Tab Data
  const [overviewData, setOverviewData] = useState<AnalyticsOverviewResult | null>(null);

  // Menu Performance Tab Data
  const [menuData, setMenuData] = useState<MenuPerformanceResult | null>(null);
  const [menuSort, setMenuSort] = useState<MenuPerformanceSortKey>('revenue');

  // Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async (range: DateRange) => {
    try {
      setIsRefreshing(true);
      setError(null);
      const res = await api.getAnalyticsOverview(range.from, range.to);
      setOverviewData(res);
    } catch (err: any) {
      const msg = err.message || 'Failed to load analytics overview.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  const fetchMenuPerformance = useCallback(async (range: DateRange, sort: MenuPerformanceSortKey) => {
    try {
      setIsRefreshing(true);
      setError(null);
      const res = await api.getMenuPerformance(range.from, range.to, sort);
      setMenuData(res);
    } catch (err: any) {
      const msg = err.message || 'Failed to load menu performance analytics.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === 'OVERVIEW') {
      fetchOverview(dateRange);
    } else {
      fetchMenuPerformance(dateRange, menuSort);
    }
  }, [activeTab, dateRange, menuSort, fetchOverview, fetchMenuPerformance]);

  const handleApplyRange = (newRange: DateRange) => {
    setDateRange(newRange);
  };

  const handleSortChange = (newSort: MenuPerformanceSortKey) => {
    setMenuSort(newSort);
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
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight">
              Business Analytics
            </h1>
            <span className="bg-cream-100 text-forest-900 border border-forest-800/20 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              Phase 3 CA Grade
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Operational trends, menu item profitability, expense breakdowns, and transaction exceptions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              if (activeTab === 'OVERVIEW') fetchOverview(dateRange);
              else fetchMenuPerformance(dateRange, menuSort);
            }}
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

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'OVERVIEW'
              ? 'border-forest-800 text-forest-800 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MENU_PERFORMANCE')}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'MENU_PERFORMANCE'
              ? 'border-forest-800 text-forest-800 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Menu Item Performance</span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : error ? (
        /* Error State */
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-rose-900">Failed to load analytics</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (activeTab === 'OVERVIEW') fetchOverview(dateRange);
              else fetchMenuPerformance(dateRange, menuSort);
            }}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      ) : activeTab === 'OVERVIEW' && overviewData ? (
        /* ================= OVERVIEW TAB ================= */
        <div className="space-y-6">
          {/* Executive Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <PnlKpiCard
              title="Average Order Value"
              value={overviewData.revenue.averageOrderValue}
              subtitle={`${overviewData.revenue.billCount} completed bills`}
              tooltip="Gross revenue divided by total bill count."
              icon={<ShoppingBag className="w-4 h-4" />}
            />
            <PnlKpiCard
              title="Gross Revenue"
              value={overviewData.revenue.grossRevenue}
              subtitle="Total billed orders"
              tooltip="Total transaction value before discounts and tax deductions."
              icon={<DollarSign className="w-4 h-4" />}
            />
            <PnlKpiCard
              title="Net Sales"
              value={overviewData.revenue.netSales}
              subtitle="After discounts & GST"
              tooltip="Net income retained after tax and discount deductions."
              icon={<TrendingUp className="w-4 h-4" />}
              valueClassName="text-forest-800"
            />
            <PnlKpiCard
              title="Operating Expenses"
              value={overviewData.expenses.total}
              subtitle="All active recorded expenses"
              tooltip="Operating expenses recorded in this reporting period."
              icon={<Receipt className="w-4 h-4" />}
            />
          </div>

          {/* Strictly Separated Metrics: Food Cost Coverage vs Overall Completeness (Correction 3) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Food Cost Coverage */}
            <Card className="p-4 sm:p-5 border-border bg-white shadow-2xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Food Cost Recipe Coverage
              </span>
              <div className="font-serif text-2xl sm:text-3xl font-bold text-forest-800">
                {overviewData.foodCost.coveragePercent ? `${overviewData.foodCost.coveragePercent}%` : '—'}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Percentage of completed bill lines linked to active recipes with historical unit costs.
              </p>
            </Card>

            {/* Card 2: Overall Data Completeness */}
            <Card className="p-4 sm:p-5 border-border bg-white shadow-2xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Overall Data Completeness Status
              </span>
              <div>
                {renderCompletenessBadge(overviewData.foodCost.completenessStatus)}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Deterministic audit status derived from recipe linkage, cost availability, and stock override exceptions.
              </p>
            </Card>
          </div>

          {/* Operating Expense by Category Breakdown */}
          <Card className="p-5 sm:p-6 border-border bg-white shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <div>
                <h3 className="font-serif text-lg font-bold text-forest-800 tracking-tight">
                  Expense Category Distribution
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Recorded operational expenditures broken down by expense category
                </p>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
                Total OpEx: {formatINR(overviewData.expenses.total)}
              </span>
            </div>

            {overviewData.expenses.byCategory.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs font-medium">
                No recorded operating expenses for this period.
              </div>
            ) : (
              <div className="space-y-3">
                {overviewData.expenses.byCategory.map((cat, idx) => {
                  const catNum = Number(cat.total) || 0;
                  const totalNum = Number(overviewData.expenses.total) || 1;
                  const pct = Math.min(((catNum / totalNum) * 100), 100).toFixed(1);

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>{cat.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-normal">({pct}%)</span>
                          <span className="font-bold text-slate-900">{formatINR(cat.total)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-forest-700 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Payment Splits & Operational Exceptions Audit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PaymentSplitCard splits={overviewData.paymentSplits} />
            <OperationalExceptionsCard
              exceptions={overviewData.operationalExceptions}
              wastageIndicators={overviewData.wastageIndicators}
            />
          </div>
        </div>
      ) : activeTab === 'MENU_PERFORMANCE' && menuData ? (
        /* ================= MENU PERFORMANCE TAB ================= */
        <MenuPerformanceTable
          items={menuData.items}
          summary={menuData.summary}
          appliedSort={menuData.appliedSort}
          onSortChange={handleSortChange}
          isLoading={isRefreshing}
        />
      ) : null}
    </div>
  );
}
