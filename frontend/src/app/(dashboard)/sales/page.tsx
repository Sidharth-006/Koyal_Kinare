'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { SalesMetricsDTO, BillDTO } from '@/lib/types';
import { formatINR } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { TrendingUp, FileText, ShoppingBag, FolderKanban, ArrowRight } from 'lucide-react';

export default function SalesAnalyticsPage() {
  const { showToast } = useToast();

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'BILLS' | 'ITEMS' | 'CATEGORIES'>('SUMMARY');

  const [loading, setLoading] = useState(true);
  const [salesMetrics, setSalesMetrics] = useState<SalesMetricsDTO | null>(null);
  const [bills, setBills] = useState<BillDTO[]>([]);

  useEffect(() => {
    loadSalesData();
  }, [startDate, endDate]);

  const loadSalesData = async () => {
    setLoading(true);
    try {
      const [salesRes, billsRes] = await Promise.all([
        api.getSalesMetrics(startDate, endDate),
        api.listBills({ startDate, endDate })
      ]);
      setSalesMetrics(salesRes.sales);
      setBills(billsRes.bills || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load sales analytics data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Quick Date Range Presets
  const setPreset = (preset: 'TODAY' | 'YESTERDAY' | 'LAST7' | 'MONTH') => {
    const now = new Date();
    if (preset === 'TODAY') {
      const d = now.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'YESTERDAY') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'LAST7') {
      const l = new Date(now);
      l.setDate(l.getDate() - 6);
      setStartDate(l.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  const voidedBills = bills.filter(b => b.status === 'VOIDED');
  const voidedAmount = voidedBills.reduce((sum, b) => sum + Number(b.grand_total || b.grandTotal || 0), 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Date Range Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight">Sales Analytics & Bills</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Financial performance, transaction audit logs, and item breakdowns</p>
        </div>

        {/* Date Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-auto font-semibold text-forest-800"
            />
            <span className="text-slate-400 text-xs font-bold uppercase">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-auto font-semibold text-forest-800"
            />
          </div>
          <div className="flex gap-1 bg-cream-50 p-1 border border-border rounded-xl text-xs font-semibold">
            <button
              onClick={() => setPreset('TODAY')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                startDate === today && endDate === today ? 'bg-forest-800 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setPreset('YESTERDAY')}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 transition-colors"
            >
              Yesterday
            </button>
            <button
              onClick={() => setPreset('LAST7')}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 transition-colors"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setPreset('MONTH')}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 transition-colors"
            >
              This Month
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Tabs */}
      <Card className="flex flex-wrap gap-2 bg-cream-50 p-1.5 border-border">
        <button
          onClick={() => setActiveTab('SUMMARY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
            activeTab === 'SUMMARY'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Performance Overview</span>
        </button>
        <button
          onClick={() => setActiveTab('BILLS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
            activeTab === 'BILLS'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Bills Audit Log ({bills.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('ITEMS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
            activeTab === 'ITEMS'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Item Performance</span>
        </button>
        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
            activeTab === 'CATEGORIES'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>Category Sales</span>
        </button>
      </Card>

      {loading ? (
        <Card className="p-8 text-center text-slate-400 font-medium">Loading sales analytics...</Card>
      ) : (
        <>
          {/* TAB 1: SUMMARY */}
          {activeTab === 'SUMMARY' && salesMetrics && (
            <div className="space-y-6">
              {/* Top KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Card hoverable className="border-border">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Net Sales Revenue</p>
                  <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                    {formatINR(salesMetrics.totalSales)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">Excludes voided bills</p>
                </Card>

                <Card hoverable className="border-border">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Completed Bills</p>
                  <p className="text-2xl font-extrabold text-forest-800 mt-1">
                    {salesMetrics.billCount}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">Paid transactions</p>
                </Card>

                <Card hoverable className="border-border">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Average Bill Value</p>
                  <p className="text-2xl font-extrabold text-forest-800 mt-1">
                    {formatINR(salesMetrics.averageOrderValue)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">Revenue ÷ Bills</p>
                </Card>

                <Card hoverable className="border-border">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Voided Transactions</p>
                  <p className="text-2xl font-extrabold text-rose-600 mt-1">
                    {voidedBills.length} ({formatINR(voidedAmount)})
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">Excluded from sales totals</p>
                </Card>
              </div>

              {/* Payment Methods Breakdown */}
              <Card className="space-y-4 border-border">
                <h3 className="font-bold text-forest-800 text-base border-b border-border pb-2">
                  Payment Method Splits
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-cream-50 border border-border rounded-2xl space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">💵 Cash Collections</span>
                    <p className="text-xl font-extrabold text-forest-800">
                      {formatINR(salesMetrics.paymentSplits?.CASH || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-cream-50 border border-border rounded-2xl space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">📱 UPI Collections</span>
                    <p className="text-xl font-extrabold text-forest-800">
                      {formatINR(salesMetrics.paymentSplits?.UPI || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-cream-50 border border-border rounded-2xl space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">💳 Card Collections</span>
                    <p className="text-xl font-extrabold text-forest-800">
                      {formatINR(salesMetrics.paymentSplits?.CARD || 0)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: BILLS AUDIT LOG */}
          {activeTab === 'BILLS' && (
            <Card className="p-0 overflow-hidden border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-cream-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="p-4">Bill #</th>
                      <th className="p-4">Date & Time</th>
                      <th className="p-4">Order Type</th>
                      <th className="p-4">Table</th>
                      <th className="p-4 text-right">Grand Total</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-sm">
                    {bills.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                          No bills found for the selected date range
                        </td>
                      </tr>
                    ) : (
                      bills.map((bill) => {
                        const isVoided = bill.status === 'VOIDED';
                        const bNum = bill.bill_number || bill.billNumber;
                        const cAt = bill.created_at || bill.createdAt;
                        const oType = bill.order_type || bill.orderType;
                        const tName = bill.table_name || bill.tableName;
                        const gTotal = bill.grand_total || bill.grandTotal;

                        return (
                          <tr
                            key={bill.id}
                            className={`hover:bg-cream-50/50 transition-colors ${
                              isVoided ? 'opacity-60 bg-slate-50 line-through' : ''
                            }`}
                          >
                            <td className="p-4 font-mono font-bold text-forest-800">
                              #{bNum}
                            </td>
                            <td className="p-4 text-slate-600 text-xs font-mono whitespace-nowrap font-medium">
                              {cAt ? new Date(cAt).toLocaleString() : '-'}
                            </td>
                            <td className="p-4 font-bold text-slate-700">
                              <Badge variant="info">{oType}</Badge>
                            </td>
                            <td className="p-4 text-slate-600 font-medium">{tName || '-'}</td>
                            <td className="p-4 text-right font-extrabold text-forest-800 whitespace-nowrap">
                              {formatINR(gTotal)}
                            </td>
                            <td className="p-4 text-center">
                              {isVoided ? (
                                <Badge variant="danger">VOIDED</Badge>
                              ) : (
                                <Badge variant="success">PAID</Badge>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <Link href={`/sales/bills/${bill.id}`}>
                                <Button variant="ghost" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                                  View Details
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 3: ITEM PERFORMANCE */}
          {activeTab === 'ITEMS' && salesMetrics && (
            <Card className="p-0 overflow-hidden border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-cream-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="p-4">Item Name</th>
                      <th className="p-4">Category</th>
                      <th className="p-4 text-center">Quantity Sold</th>
                      <th className="p-4 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-sm">
                    {!salesMetrics.itemBreakdown || salesMetrics.itemBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400 font-medium">
                          No item performance data recorded
                        </td>
                      </tr>
                    ) : (
                      salesMetrics.itemBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-cream-50/50 transition-colors">
                          <td className="p-4 font-bold text-slate-800">{item.item_name}</td>
                          <td className="p-4 text-slate-500 font-medium">{item.category_name}</td>
                          <td className="p-4 text-center font-bold text-slate-800">{item.total_quantity}</td>
                          <td className="p-4 text-right font-extrabold text-forest-800">
                            {formatINR(item.total_revenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 4: CATEGORY PERFORMANCE */}
          {activeTab === 'CATEGORIES' && salesMetrics && (
            <Card className="p-0 overflow-hidden border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-cream-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="p-4">Category Name</th>
                      <th className="p-4 text-center">Items Sold</th>
                      <th className="p-4 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-sm">
                    {!salesMetrics.categoryBreakdown || salesMetrics.categoryBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-400 font-medium">
                          No category performance data recorded
                        </td>
                      </tr>
                    ) : (
                      salesMetrics.categoryBreakdown.map((cat, idx) => (
                        <tr key={idx} className="hover:bg-cream-50/50 transition-colors">
                          <td className="p-4 font-bold text-slate-800">{cat.category_name}</td>
                          <td className="p-4 text-center font-bold text-slate-800">{cat.total_quantity}</td>
                          <td className="p-4 text-right font-extrabold text-forest-800">
                            {formatINR(cat.total_revenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
