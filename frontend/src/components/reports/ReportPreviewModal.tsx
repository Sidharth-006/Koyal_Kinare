'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/format';
import { Download, FileSpreadsheet, FileText, AlertCircle, Calendar, Coffee, Clock } from 'lucide-react';

export type ReportTypeKey =
  | 'SALES_REGISTER'
  | 'PURCHASE_REGISTER'
  | 'EXPENSE_REGISTER'
  | 'MONTHLY_PNL'
  | 'INVENTORY_VALUATION'
  | 'RECONCILIATION';

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportTypeKey;
  reportTitle: string;
  from?: string;
  to?: string;
  asOf?: string;
  onExport: (format: 'XLSX' | 'PDF') => void;
  isExporting?: boolean;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  isOpen,
  onClose,
  reportType,
  reportTitle,
  from = '',
  to = '',
  asOf = '',
  onExport,
  isExporting = false
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError(null);
      return;
    }

    const fetchReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        let res: any;
        switch (reportType) {
          case 'SALES_REGISTER':
            res = await api.getSalesRegister(from, to);
            break;
          case 'PURCHASE_REGISTER':
            res = await api.getPurchaseRegister(from, to);
            break;
          case 'EXPENSE_REGISTER':
            res = await api.getExpenseRegister(from, to);
            break;
          case 'MONTHLY_PNL':
            res = await api.getMonthlyPnl(from, to);
            break;
          case 'INVENTORY_VALUATION':
            res = await api.getInventoryValuationReport(asOf || undefined);
            break;
          case 'RECONCILIATION':
            res = await api.getReconciliationRangeReport(from, to);
            break;
          default:
            throw new Error('Unsupported report preview type');
        }
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to load report data.');
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [isOpen, reportType, from, to, asOf]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-4 py-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="py-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-800">Unable to load report</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">{error}</p>
        </div>
      );
    }

    if (!data) return null;

    return (
      <div className="space-y-5 font-sans">
        {/* Meta Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-cream-50 border border-border rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-forest-800" />
            <span className="font-bold text-forest-800">{data.cafeIdentity?.cafeName || 'Koyal Kinare Cafe'}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 font-medium">Currency: {data.cafeIdentity?.currency || 'INR'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Generated: {data.reportedAt ? new Date(data.reportedAt).toLocaleString('en-IN') : 'Recent'}</span>
          </div>
        </div>

        {/* Data Limitation Notice if present */}
        {(data.dataLimitation || (data.dataLimitations && data.dataLimitations.length > 0)) && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {data.dataLimitation || data.dataLimitations[0]}
            </p>
          </div>
        )}

        {/* Report Specific Summary & Tables */}
        {reportType === 'SALES_REGISTER' && renderSalesRegister(data)}
        {reportType === 'PURCHASE_REGISTER' && renderPurchaseRegister(data)}
        {reportType === 'EXPENSE_REGISTER' && renderExpenseRegister(data)}
        {reportType === 'MONTHLY_PNL' && renderMonthlyPnl(data)}
        {reportType === 'INVENTORY_VALUATION' && renderInventoryValuation(data)}
        {reportType === 'RECONCILIATION' && renderReconciliation(data)}
      </div>
    );
  };

  // 1. Sales Register View
  const renderSalesRegister = (d: any) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Bills</span>
          <span className="text-lg font-bold text-slate-800">{d.summary?.totalBills}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Gross Revenue</span>
          <span className="text-lg font-bold text-forest-800">{formatINR(d.summary?.totalGrossRevenue)}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Tax</span>
          <span className="text-lg font-bold text-slate-800">{formatINR(d.summary?.totalTax)}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Net Sales</span>
          <span className="text-lg font-bold text-emerald-700">{formatINR(d.summary?.totalNetSales)}</span>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto border border-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
            <tr>
              <th className="p-2.5">Bill #</th>
              <th className="p-2.5">Date</th>
              <th className="p-2.5">Type</th>
              <th className="p-2.5 text-right">Subtotal</th>
              <th className="p-2.5 text-right">Discount</th>
              <th className="p-2.5 text-right">Tax</th>
              <th className="p-2.5 text-right">Grand Total</th>
              <th className="p-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {d.items?.length === 0 ? (
              <tr><td colSpan={8} className="p-4 text-center text-slate-400">No records found</td></tr>
            ) : (
              d.items?.map((item: any) => (
                <tr key={item.billId} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-800">{item.billNumber}</td>
                  <td className="p-2.5 text-slate-600">{formatDate(item.businessDate)}</td>
                  <td className="p-2.5 text-slate-600">{item.orderType}</td>
                  <td className="p-2.5 text-right">{formatINR(item.subtotal)}</td>
                  <td className="p-2.5 text-right text-amber-700">{formatINR(item.discount)}</td>
                  <td className="p-2.5 text-right">{formatINR(item.tax)}</td>
                  <td className="p-2.5 text-right font-bold text-forest-800">{formatINR(item.grandTotal)}</td>
                  <td className="p-2.5 text-center">
                    <Badge variant={item.status === 'COMPLETED' ? 'success' : 'danger'} className="text-[10px]">
                      {item.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 2. Purchase Register View
  const renderPurchaseRegister = (d: any) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Purchases</span>
          <span className="text-lg font-bold text-slate-800">{d.summary?.totalPurchases}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Received Spend</span>
          <span className="text-lg font-bold text-forest-800">{formatINR(d.summary?.receivedTotal)}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Tax Amount</span>
          <span className="text-lg font-bold text-slate-800">{formatINR(d.summary?.taxTotal)}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Discounts</span>
          <span className="text-lg font-bold text-slate-800">{formatINR(d.summary?.discountTotal)}</span>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto border border-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
            <tr>
              <th className="p-2.5">PO #</th>
              <th className="p-2.5">Supplier</th>
              <th className="p-2.5">Date</th>
              <th className="p-2.5">Invoice #</th>
              <th className="p-2.5">Payment</th>
              <th className="p-2.5 text-right">Tax</th>
              <th className="p-2.5 text-right">Grand Total</th>
              <th className="p-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {d.items?.length === 0 ? (
              <tr><td colSpan={8} className="p-4 text-center text-slate-400">No records found</td></tr>
            ) : (
              d.items?.map((item: any) => (
                <tr key={item.purchaseId} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-800">{item.purchaseNumber}</td>
                  <td className="p-2.5 font-medium text-slate-700">{item.supplierName}</td>
                  <td className="p-2.5 text-slate-600">{formatDate(item.purchaseDate)}</td>
                  <td className="p-2.5 text-slate-600">{item.invoiceNumber || '—'}</td>
                  <td className="p-2.5 text-slate-600">{item.paymentMethod}</td>
                  <td className="p-2.5 text-right">{formatINR(item.taxAmount)}</td>
                  <td className="p-2.5 text-right font-bold text-forest-800">{formatINR(item.grandTotal)}</td>
                  <td className="p-2.5 text-center">
                    <Badge variant={item.status === 'RECEIVED' ? 'success' : 'neutral'} className="text-[10px]">
                      {item.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 3. Expense Register View
  const renderExpenseRegister = (d: any) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Expenses</span>
          <span className="text-lg font-bold text-slate-800">{d.summary?.totalExpenses}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Active Total</span>
          <span className="text-lg font-bold text-forest-800">{formatINR(d.summary?.activeTotal)}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Voided Count</span>
          <span className="text-lg font-bold text-rose-700">{d.summary?.voidedCount}</span>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto border border-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
            <tr>
              <th className="p-2.5">Date</th>
              <th className="p-2.5">Category</th>
              <th className="p-2.5">Description</th>
              <th className="p-2.5">Payment</th>
              <th className="p-2.5 text-right">Amount</th>
              <th className="p-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {d.items?.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-slate-400">No records found</td></tr>
            ) : (
              d.items?.map((item: any) => (
                <tr key={item.expenseId} className="hover:bg-slate-50">
                  <td className="p-2.5 text-slate-600">{formatDate(item.businessDate)}</td>
                  <td className="p-2.5 font-bold text-slate-800">{item.category}</td>
                  <td className="p-2.5 text-slate-600 truncate max-w-[200px]">{item.description}</td>
                  <td className="p-2.5 text-slate-600">{item.paymentMethod}</td>
                  <td className="p-2.5 text-right font-bold text-forest-800">{formatINR(item.amount)}</td>
                  <td className="p-2.5 text-center">
                    <Badge variant={item.isVoided ? 'danger' : 'success'} className="text-[10px]">
                      {item.isVoided ? 'Voided' : 'Active'}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 4. Monthly P&L View
  const renderMonthlyPnl = (d: any) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Net Sales</span>
          <span className="text-lg font-bold text-forest-800">{formatINR(d.totals?.netSales)}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Food Cost</span>
          <span className="text-lg font-bold text-slate-800">{formatINR(d.totals?.foodCost)}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Net Profit</span>
          <span className="text-lg font-bold text-emerald-700">{formatINR(d.totals?.netProfit)}</span>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto border border-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
            <tr>
              <th className="p-2.5">Month</th>
              <th className="p-2.5 text-right">Net Sales</th>
              <th className="p-2.5 text-right">Food Cost</th>
              <th className="p-2.5 text-right">Food Cost %</th>
              <th className="p-2.5 text-right">Gross Profit</th>
              <th className="p-2.5 text-right">OpEx</th>
              <th className="p-2.5 text-right">Net Profit</th>
              <th className="p-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {d.months?.length === 0 ? (
              <tr><td colSpan={8} className="p-4 text-center text-slate-400">No records found</td></tr>
            ) : (
              d.months?.map((m: any) => (
                <tr key={m.yearMonth} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-800">{m.yearMonth}</td>
                  <td className="p-2.5 text-right font-medium">{formatINR(m.netSales)}</td>
                  <td className="p-2.5 text-right font-medium">{formatINR(m.foodCost)}</td>
                  <td className="p-2.5 text-right font-semibold text-amber-700">{m.foodCostPercent ? `${m.foodCostPercent}%` : '—'}</td>
                  <td className="p-2.5 text-right font-medium">{formatINR(m.grossProfit)}</td>
                  <td className="p-2.5 text-right font-medium">{formatINR(m.operatingExpenses)}</td>
                  <td className="p-2.5 text-right font-bold text-forest-800">{formatINR(m.netProfit)}</td>
                  <td className="p-2.5 text-center">
                    <Badge variant={m.completenessStatus === 'COMPLETE' ? 'success' : 'warning'} className="text-[10px]">
                      {m.completenessStatus}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 5. Inventory Valuation View
  const renderInventoryValuation = (d: any) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Items</span>
          <span className="text-lg font-bold text-slate-800">{d.summary?.totalItems}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Costed Items</span>
          <span className="text-lg font-bold text-emerald-700">{d.summary?.costedItems}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Uncosted Items</span>
          <span className="text-lg font-bold text-amber-700">{d.summary?.uncostedItems}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Valuation</span>
          <span className="text-lg font-bold text-forest-800">{formatINR(d.summary?.totalValuation)}</span>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto border border-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
            <tr>
              <th className="p-2.5">Item Name</th>
              <th className="p-2.5">Type</th>
              <th className="p-2.5">Unit</th>
              <th className="p-2.5 text-right">Current Stock</th>
              <th className="p-2.5 text-right">Avg Unit Cost</th>
              <th className="p-2.5 text-right">Total Valuation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {d.items?.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-slate-400">No records found</td></tr>
            ) : (
              d.items?.map((item: any) => (
                <tr key={item.itemId} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-800">{item.itemName}</td>
                  <td className="p-2.5 text-slate-600">{item.itemType}</td>
                  <td className="p-2.5 text-slate-600">{item.baseUnit}</td>
                  <td className="p-2.5 text-right font-medium">{item.currentQuantity}</td>
                  <td className="p-2.5 text-right font-medium">
                    {item.averageUnitCost ? formatINR(item.averageUnitCost) : '—'}
                  </td>
                  <td className="p-2.5 text-right font-bold text-forest-800">
                    {item.totalValue ? formatINR(item.totalValue) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 6. Reconciliation View
  const renderReconciliation = (d: any) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Days</span>
          <span className="text-lg font-bold text-slate-800">{d.summary?.totalDays}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Closed Days</span>
          <span className="text-lg font-bold text-emerald-700">{d.summary?.closedDays}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Mismatched Days</span>
          <span className="text-lg font-bold text-rose-700">{d.summary?.mismatchedDays}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-border/60">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Cash Sales</span>
          <span className="text-lg font-bold text-forest-800">{formatINR(d.summary?.totalCashSales)}</span>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto border border-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
            <tr>
              <th className="p-2.5">Date</th>
              <th className="p-2.5 text-right">Opening Cash</th>
              <th className="p-2.5 text-right">Cash Sales</th>
              <th className="p-2.5 text-right">Expected Cash</th>
              <th className="p-2.5 text-right">Actual Cash</th>
              <th className="p-2.5 text-right">Cash Variance</th>
              <th className="p-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {d.days?.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-400">No records found</td></tr>
            ) : (
              d.days?.map((day: any) => (
                <tr key={day.businessDate} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-800">{formatDate(day.businessDate)}</td>
                  <td className="p-2.5 text-right">{formatINR(day.openingCash)}</td>
                  <td className="p-2.5 text-right font-medium">{formatINR(day.cashSales)}</td>
                  <td className="p-2.5 text-right">{formatINR(day.expectedClosingCash)}</td>
                  <td className="p-2.5 text-right font-medium">{day.actualCash ? formatINR(day.actualCash) : '—'}</td>
                  <td className={`p-2.5 text-right font-bold ${Number(day.cashDifference || 0) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {day.cashDifference ? formatINR(day.cashDifference) : '—'}
                  </td>
                  <td className="p-2.5 text-center">
                    <Badge
                      variant={day.status === 'CLOSED' ? 'success' : day.status === 'MISMATCHED' ? 'danger' : 'warning'}
                      className="text-[10px]"
                    >
                      {day.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={reportTitle}
      size="xl"
    >
      <div className="space-y-4">
        {renderContent()}

        {/* Modal Action Footer */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-400 font-medium">
            Export directly to download full official document
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onExport('XLSX')}
              isLoading={isExporting}
              icon={<FileSpreadsheet className="w-4 h-4 text-emerald-700" />}
              className="flex-1 sm:flex-none"
            >
              Export XLSX
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onExport('PDF')}
              isLoading={isExporting}
              icon={<FileText className="w-4 h-4 text-rose-700" />}
              className="flex-1 sm:flex-none"
            >
              Export PDF
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex-1 sm:flex-none"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
