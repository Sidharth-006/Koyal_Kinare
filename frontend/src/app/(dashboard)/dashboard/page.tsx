'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, ShoppingBag, Receipt, SlidersHorizontal, Info, RefreshCw,
  CreditCard, DollarSign, Wallet, AlertCircle, ArrowUpRight, Award, Flame, Calendar
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { DashboardMetricsDTO } from '@/lib/types';
import { formatINR, getTodayIsoDate } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';

export default function DashboardPage() {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIsoDate());
  const [metrics, setMetrics] = useState<DashboardMetricsDTO | null>(null);
  const [recon, setRecon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  const fetchMetrics = useCallback(async (dateStr: string) => {
    try {
      setIsRefreshing(true);
      const [metricsRes, reconRes] = await Promise.allSettled([
        api.getDashboardMetrics(dateStr),
        api.getReconciliationPreview(dateStr)
      ]);
      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value.metrics);
      }
      if (reconRes.status === 'fulfilled') {
        setRecon(reconRes.value.reconciliation);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load dashboard metrics', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchMetrics(selectedDate);
  }, [selectedDate, fetchMetrics]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in font-sans pb-10">
      {/* Top Header Greeting */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight">Good Morning, Admin 👋</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Here&apos;s what&apos;s happening at Koyal Kinare today.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => fetchMetrics(selectedDate)}
            isLoading={isRefreshing}
            icon={<RefreshCw className="w-4 h-4 text-forest-800" />}
            className="border-border shadow-2xs"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Hero Banner & Target Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Hero Image Card */}
        <div className="lg:col-span-2 relative rounded-3xl overflow-hidden min-h-[200px] flex flex-col justify-end p-8 text-white shadow-card border border-border">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80')`
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-forest-900/90 via-forest-900/60 to-transparent" />
          
          <div className="relative z-10 max-w-lg">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-semibold backdrop-blur-sm mb-3">
              <Flame className="w-3.5 h-3.5" /> Premium Ambience
            </span>
            <h2 className="font-serif italic text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
              Good Food, Good Vibes
            </h2>
            <p className="text-xs md:text-sm text-cream-100/90 mt-1.5 font-medium">
              Koyal Kinare • Serving happiness by the waterside
            </p>
          </div>
        </div>

        {/* Right Target Progress Card */}
        <Card className="flex flex-col justify-between bg-white border-border relative">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">Today&apos;s Target</span>
              <Award className="w-5 h-5 text-amber-500" />
            </div>

            <div className="flex items-center gap-5">
              {/* Circular Progress Display */}
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-forest-800 transition-all duration-700 ease-out"
                    strokeDasharray={`${metrics ? Math.min(100, metrics.dailyProgressPercent) : 0}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-sm font-extrabold text-forest-800">
                  {metrics ? `${metrics.dailyProgressPercent}%` : '0%'}
                </span>
              </div>

              <div>
                <p className="text-2xl font-extrabold text-forest-800 tracking-tight">
                  {metrics ? formatINR(metrics.todayCompletedSales) : '₹0'}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  of {metrics ? formatINR(metrics.dailyTarget) : '₹0'} target
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Keep going! You&apos;re doing great!</span>
            <Badge variant="forest">On Track</Badge>
          </div>
        </Card>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/pos" className="w-full">
          <Button variant="primary" size="lg" className="w-full justify-between shadow-md" icon={<ShoppingBag className="w-5 h-5" />}>
            <span>New POS Bill</span>
            <ArrowUpRight className="w-5 h-5 opacity-80" />
          </Button>
        </Link>
        <Link href="/expenses" className="w-full">
          <Button variant="secondary" size="lg" className="w-full justify-between" icon={<Receipt className="w-5 h-5 text-forest-800" />}>
            <span>Log Expense</span>
            <ArrowUpRight className="w-5 h-5 text-slate-400" />
          </Button>
        </Link>
        <Link href="/reconciliation" className="w-full">
          <Button variant="accent" size="lg" className="w-full justify-between" icon={<SlidersHorizontal className="w-5 h-5" />}>
            <span>Daily Closing</span>
            <ArrowUpRight className="w-5 h-5 opacity-80" />
          </Button>
        </Link>
      </div>

      {/* Daily Closing & Register Status Alert Banner */}
      {recon && (
        <Card className="bg-white border-border shadow-2xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {(() => {
              const closingRecord = recon.closing || recon.closingRecord;
              const isDayClosed = closingRecord?.status === 'CLOSED' || closingRecord?.isClosed;
              const openingVal = recon.opening?.opening_cash ?? recon.opening?.openingCash ?? recon.openingCash ?? 0;
              const expectedVal = recon.expectedCash ?? recon.expectedClosingCash ?? recon.expected_closing_cash ?? 0;
              const cashMismatch = closingRecord?.cash_difference ?? closingRecord?.cashDifference ?? 0;

              return (
                <>
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isDayClosed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      <SlidersHorizontal className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-800">Daily Closing & Shift Status</h2>
                        {isDayClosed ? (
                          <Badge variant="success">Day Closed & Finalized</Badge>
                        ) : (
                          <Badge variant="warning">Register Open</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Opening Cash Float: <span className="font-semibold text-slate-700">{formatINR(openingVal)}</span> • Expected Cash in Drawer: <span className="font-semibold text-slate-700">{formatINR(expectedVal)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    {Number(cashMismatch) !== 0 && isDayClosed && (
                      <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                        Cash Mismatch: {formatINR(cashMismatch)}
                      </span>
                    )}
                    <Link href="/reconciliation">
                      <Button variant="secondary" size="sm" className="text-xs font-bold">
                        {isDayClosed ? 'View Audit Record' : 'Perform Closing'}
                      </Button>
                    </Link>
                  </div>
                </>
              );
            })()}
          </div>
        </Card>
      )}

      {/* Main KPI Card Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sales Card */}
            <Card hoverable className="border-forest-800/20 bg-gradient-to-br from-white via-white to-forest-100/30">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Today Sales</span>
                <div className="p-2 bg-forest-100 rounded-xl text-forest-800">
                  <TrendingUp className="w-4.5 h-4.5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-forest-800 tracking-tight">{formatINR(metrics.todayCompletedSales)}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>{metrics.completedBillCount} Bills Completed</span>
                <span>AOV: {formatINR(metrics.averageBillValue)}</span>
              </div>
            </Card>

            {/* Daily Target Remaining Card */}
            <Card hoverable>
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Daily Target Gap</span>
                <Badge variant={metrics.dailyProgressPercent >= 100 ? 'success' : 'warning'}>
                  {metrics.dailyProgressPercent}%
                </Badge>
              </div>
              <p className="text-2xl font-extrabold text-slate-800 tracking-tight">{formatINR(metrics.dailyTarget)}</p>
              <div className="mt-3.5 w-full bg-cream-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-forest-800 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, metrics.dailyProgressPercent)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 font-medium">Remaining: {formatINR(metrics.dailyRemaining)}</p>
            </Card>

            {/* Expenses Card */}
            <Card hoverable className="border-rose-100">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Today Expenses</span>
                <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                  <Receipt className="w-4.5 h-4.5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-rose-600 tracking-tight">{formatINR(metrics.todayExpenses)}</p>
              <p className="mt-3 text-xs text-slate-500 font-medium">Reduces expected closing cash</p>
            </Card>

            {/* Estimated Net Profit Card */}
            <Card hoverable className="border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Est. Net Profit</span>
                  <Badge variant="warning">ESTIMATED</Badge>
                </div>
                <button
                  onClick={() => setShowDisclaimerModal(true)}
                  className="text-slate-400 hover:text-forest-800 p-1 transition-colors"
                  aria-label="Profit Disclaimer"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
              <p className="text-2xl font-extrabold text-emerald-700 tracking-tight">{formatINR(metrics.estimatedProfit)}</p>
              <p className="mt-3 text-xs text-slate-500 font-medium">Sales minus recorded expenses</p>
            </Card>
          </div>

          {/* Secondary Metrics & Payment Splits */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Method Split */}
            <Card className="lg:col-span-2">
              <h2 className="text-base font-bold text-forest-800 mb-4 flex items-center justify-between">
                <span>Payment Method Breakdown</span>
                <span className="text-xs font-normal text-slate-500">Live Today</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-cream-50 border border-border flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                    <div className="p-1.5 bg-emerald-100 rounded-lg">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <span>Cash Sales</span>
                  </div>
                  <p className="text-xl font-extrabold text-slate-900 mt-3">{formatINR(metrics.cashSales)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-cream-50 border border-border flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-sky-700 text-xs font-bold uppercase tracking-wider">
                    <div className="p-1.5 bg-sky-100 rounded-lg">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <span>UPI Sales</span>
                  </div>
                  <p className="text-xl font-extrabold text-slate-900 mt-3">{formatINR(metrics.upiSales)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-cream-50 border border-border flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-purple-700 text-xs font-bold uppercase tracking-wider">
                    <div className="p-1.5 bg-purple-100 rounded-lg">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <span>Card Sales</span>
                  </div>
                  <p className="text-xl font-extrabold text-slate-900 mt-3">{formatINR(metrics.cardSales)}</p>
                </div>
              </div>
            </Card>

            {/* Monthly Target Progress */}
            <Card className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Monthly Progress</span>
                  <Badge variant="info">{metrics.monthlyProgressPercent}%</Badge>
                </div>
                <p className="text-2xl font-extrabold text-forest-800 tracking-tight">{formatINR(metrics.monthlySales)}</p>
                <div className="mt-3.5 w-full bg-cream-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, metrics.monthlyProgressPercent)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 font-medium">Monthly Target: {formatINR(metrics.monthlyTarget)}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Detailed Sales Reports</span>
                <Link href="/sales" className="text-xs font-bold text-forest-800 hover:underline flex items-center gap-1">
                  <span>View All</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {/* Disclaimer Context Modal */}
      <Modal
        isOpen={showDisclaimerModal}
        onClose={() => setShowDisclaimerModal(false)}
        title="Phase 1 Profitability Estimate Disclaimer"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-700" />
            <p>
              Phase 1 net profit is an <strong>ESTIMATE</strong> calculated as:
              <br />
              <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs text-amber-900">Completed Sales − Recorded Operating Expenses</code>.
            </p>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed">
            Because Phase 1 does not yet track real-time inventory purchase consumption or exact Cost of Goods Sold (COGS), actual accounting gross profit may vary. Full COGS and inventory-based profitability will be available in Phase 2.
          </p>

          <Button variant="primary" onClick={() => setShowDisclaimerModal(false)} className="mt-2">
            Understood
          </Button>
        </div>
      </Modal>
    </div>
  );
}
