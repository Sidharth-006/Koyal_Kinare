'use client';

import React, { useState, useEffect } from 'react';
import { api, downloadExportFile } from '@/lib/api';
import { InventoryItemDTO, SupplierDTO } from '@/lib/types';
import { getTodayIsoDate } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import {
  BarChart3, ShoppingBag, Receipt, Scale, Download, FileText,
  Package, History, ShoppingCart, Truck, Trash2, TrendingUp,
  AlertCircle, Eye
} from 'lucide-react';
import { ReportPreviewModal, ReportTypeKey } from '@/components/reports/ReportPreviewModal';

interface ReportConfig {
  id: string;
  category: 'FINANCIAL' | 'INVENTORY' | 'PROFITABILITY';
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isEstimate?: boolean;
  isPhase3?: boolean;
}

const ALL_REPORTS: ReportConfig[] = [
  // Phase 3 Advanced CA & P&L Reports
  {
    id: 'SALES_REGISTER',
    category: 'FINANCIAL',
    title: 'Sales Register (GST / CA)',
    description: 'Itemized tax-audited sales register with invoice subtotal, tax rate snapshots, and payment channels',
    icon: ShoppingBag,
    isPhase3: true
  },
  {
    id: 'PURCHASE_REGISTER',
    category: 'FINANCIAL',
    title: 'Purchase Register (GST / CA)',
    description: 'Vendor procurement register with invoice references, GST tax amounts, and payment breakdown',
    icon: ShoppingCart,
    isPhase3: true
  },
  {
    id: 'EXPENSE_REGISTER',
    category: 'FINANCIAL',
    title: 'Expense Register (GST / CA)',
    description: 'Itemized operational expenses by category with tax deductions and payment audit records',
    icon: Receipt,
    isPhase3: true
  },
  {
    id: 'MONTHLY_PNL',
    category: 'PROFITABILITY',
    title: 'Monthly Grouped P&L Report',
    description: 'Multi-month income and food cost reconciliation comparing monthly revenues, costs, and margins',
    icon: TrendingUp,
    isPhase3: true
  },
  {
    id: 'INVENTORY_VALUATION',
    category: 'INVENTORY',
    title: 'Inventory Valuation Report',
    description: 'Current inventory valuation based on moving-average costs with schema limitation disclosure',
    icon: Package,
    isPhase3: true
  },
  {
    id: 'RECONCILIATION',
    category: 'FINANCIAL',
    title: 'Daily Closing & Reconciliation Register',
    description: 'Multi-day audit register of opening floats, actual cash counts, variance, and digital settlements',
    icon: Scale,
    isPhase3: true
  },
  // Phase 1 Reports
  {
    id: 'DAILY_SUMMARY',
    category: 'FINANCIAL',
    title: 'Daily Financial Summary',
    description: 'Overview of total sales, payment method breakdowns, discounts, tax, and voided transactions',
    icon: BarChart3
  },
  {
    id: 'ITEM_SALES',
    category: 'FINANCIAL',
    title: 'Item Sales Breakdown',
    description: 'Detailed quantities sold, revenue per menu item, and category sales performance',
    icon: ShoppingBag
  },
  {
    id: 'EXPENSE_REPORT',
    category: 'FINANCIAL',
    title: 'Operational Expense Audit',
    description: 'Comprehensive list of expenses categorized by raw material, utilities, salaries, and payment channels',
    icon: Receipt
  },
  {
    id: 'RECONCILIATION_REPORT',
    category: 'FINANCIAL',
    title: 'Daily Closing & Reconciliation',
    description: 'Audit logs of opening cash floats, register cash counts, digital settlements, and variances',
    icon: Scale
  },
  // Phase 2 Inventory Reports
  {
    id: 'INVENTORY_STOCK',
    category: 'INVENTORY',
    title: 'Inventory Stock Balance',
    description: 'Real-time stock valuation, on-hand balances, unit costs, and minimum threshold deficits',
    icon: Package
  },
  {
    id: 'STOCK_MOVEMENTS',
    category: 'INVENTORY',
    title: 'Stock Movements Audit',
    description: 'Comprehensive timeline of receipts, adjustments, wastage, consumption, and physical counts',
    icon: History
  },
  {
    id: 'PURCHASES',
    category: 'INVENTORY',
    title: 'Purchases & Procurement',
    description: 'Detailed purchase orders, receipts, supplier invoices, payment methods, and reversal logs',
    icon: ShoppingCart
  },
  {
    id: 'SUPPLIER_SUMMARY',
    category: 'INVENTORY',
    title: 'Supplier Volume & Summary',
    description: 'Aggregated vendor procurement volumes, spend totals, order counts, and fulfillment status',
    icon: Truck
  },
  {
    id: 'WASTAGE',
    category: 'INVENTORY',
    title: 'Wastage & Loss Audit',
    description: 'Audit logs of spoiled, damaged, or expired stock with operational reasons and loss valuation',
    icon: Trash2
  },
  // Phase 2 Profitability Report
  {
    id: 'PROFITABILITY',
    category: 'PROFITABILITY',
    title: 'Phase 2 Estimated Profitability',
    description: 'Gross sales, recorded operating expenses, cash & accrued purchase costs, and estimated margins',
    icon: TrendingUp,
    isEstimate: true
  }
];

export default function ReportsPage() {
  const { showToast } = useToast();
  const today = getTodayIsoDate();

  // Selected Report
  const [selectedReport, setSelectedReport] = useState('DAILY_SUMMARY');

  // Filter States
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [asOfDate, setAsOfDate] = useState(today);

  // Phase 2 Specific Filter States
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedMovementType, setSelectedMovementType] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedPurchaseStatus, setSelectedPurchaseStatus] = useState('');

  // Dropdown options loaded from API
  const [inventoryItems, setInventoryItems] = useState<InventoryItemDTO[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);

  // Export Loading States
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  useEffect(() => {
    // Load active inventory items and suppliers for report filters
    const loadDropdownData = async () => {
      try {
        const [itemsRes, suppliersRes] = await Promise.allSettled([
          api.listInventoryItems({ status: 'active', pageSize: 100 }),
          api.listSuppliers({ status: 'active', pageSize: 100 })
        ]);
        if (itemsRes.status === 'fulfilled') {
          setInventoryItems(itemsRes.value.items || []);
        }
        if (suppliersRes.status === 'fulfilled') {
          setSuppliers(suppliersRes.value.items || []);
        }
      } catch (err) {
        // Dropdown loading failure non-blocking
      }
    };
    loadDropdownData();
  }, []);

  const handleExport = async (fileFormat: 'XLSX' | 'PDF') => {
    const isAsOfOnly = selectedReport === 'INVENTORY_STOCK' || selectedReport === 'INVENTORY_VALUATION';

    if (!isAsOfOnly) {
      if (!startDate || !endDate) {
        showToast('Please select both start and end dates.', 'warning');
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        showToast('Start date cannot be after end date.', 'warning');
        return;
      }
    } else {
      if (!asOfDate) {
        showToast('Please select an as-of date.', 'warning');
        return;
      }
    }

    if (fileFormat === 'XLSX') setExportingExcel(true);
    else setExportingPdf(true);

    try {
      let res: any;
      let filenamePrefix = selectedReport.toLowerCase().replace(/_/g, '-');

      if (selectedReport === 'SALES_REGISTER') {
        res = await api.exportSalesRegister(startDate, endDate, fileFormat);
      } else if (selectedReport === 'PURCHASE_REGISTER') {
        res = await api.exportPurchaseRegister(startDate, endDate, fileFormat);
      } else if (selectedReport === 'EXPENSE_REGISTER') {
        res = await api.exportExpenseRegister(startDate, endDate, fileFormat);
      } else if (selectedReport === 'MONTHLY_PNL') {
        res = await api.exportMonthlyPnl(startDate, endDate, fileFormat);
      } else if (selectedReport === 'INVENTORY_VALUATION') {
        res = await api.exportInventoryValuationReport(asOfDate, fileFormat);
      } else if (selectedReport === 'RECONCILIATION') {
        res = await api.exportReconciliationRangeReport(startDate, endDate, fileFormat);
      } else if (selectedReport === 'INVENTORY_STOCK') {
        res = await api.getInventoryStockReport({
          asOf: asOfDate,
          format: fileFormat
        });
      } else if (selectedReport === 'STOCK_MOVEMENTS') {
        res = await api.getStockMovementsReport({
          from: startDate,
          to: endDate,
          itemId: selectedItemId || undefined,
          movementType: selectedMovementType || undefined,
          format: fileFormat
        });
      } else if (selectedReport === 'PURCHASES') {
        res = await api.getPurchasesReport({
          from: startDate,
          to: endDate,
          supplierId: selectedSupplierId || undefined,
          itemId: selectedItemId || undefined,
          paymentMethod: selectedPaymentMethod || undefined,
          status: selectedPurchaseStatus || undefined,
          format: fileFormat
        });
      } else if (selectedReport === 'SUPPLIER_SUMMARY') {
        res = await api.getSuppliersReport({
          from: startDate,
          to: endDate,
          format: fileFormat
        });
      } else if (selectedReport === 'WASTAGE') {
        res = await api.getWastageReport({
          from: startDate,
          to: endDate,
          format: fileFormat
        });
      } else if (selectedReport === 'PROFITABILITY') {
        res = await api.getPhase2Profitability({
          from: startDate,
          to: endDate,
          format: fileFormat
        });
      } else {
        // Phase 1 Legacy export endpoint
        res = await api.exportReport({
          reportType: selectedReport,
          startDate,
          endDate,
          fileFormat: fileFormat === 'XLSX' ? 'EXCEL' : 'PDF'
        });
      }

      const ext = fileFormat === 'XLSX' ? 'xlsx' : 'pdf';
      const dateRangeStr = isAsOfOnly ? asOfDate : `${startDate}_to_${endDate}`;
      const filename = `${filenamePrefix}_${dateRangeStr}.${ext}`;

      downloadExportFile(res, filename);
      showToast(`Report downloaded successfully as ${fileFormat}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate report export.', 'error');
    } finally {
      setExportingExcel(false);
      setExportingPdf(false);
    }
  };

  const selectedReportConfig = ALL_REPORTS.find(r => r.id === selectedReport);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans pb-10">
      {/* Header */}
      <div className="pb-2 border-b border-border/60">
        <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight">Reports & Business Intelligence</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">Generate and download official Excel spreadsheets (XLSX) or printable PDF audit documents</p>
      </div>

      {/* Step 1: Select Report Category & Type */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            1. Select Report Type
          </h2>
          <span className="text-xs text-slate-400 font-medium">10 Available Reports</span>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3.5">
          {ALL_REPORTS.map((rpt) => {
            const isSelected = selectedReport === rpt.id;
            const Icon = rpt.icon;

            return (
              <div
                key={rpt.id}
                onClick={() => setSelectedReport(rpt.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-start gap-3.5 min-h-[96px] ${
                  isSelected
                    ? 'bg-white border-forest-800 shadow-card-hover ring-2 ring-forest-800/20'
                    : 'bg-white/75 border-border hover:border-forest-800/30 hover:bg-white'
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${isSelected ? 'bg-forest-800 text-white' : 'bg-cream-100 text-forest-800'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-sm leading-snug ${isSelected ? 'text-forest-800' : 'text-slate-800'}`}>
                      {rpt.title}
                    </h3>
                    {rpt.isEstimate && (
                      <Badge variant="warning">ESTIMATED</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {rpt.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 2: Configure Parameters & Export */}
      <Card className="space-y-5 border-border bg-white p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              2. Configure Parameters & Generate Export
            </h2>
            <p className="text-xs font-bold text-forest-800 mt-1">
              Active: {selectedReportConfig?.title}
            </p>
          </div>
          {selectedReportConfig?.isEstimate && (
            <Badge variant="warning">Phase 2 Estimate</Badge>
          )}
          {selectedReportConfig?.isPhase3 && (
            <Badge variant="success">Phase 3 CA Grade</Badge>
          )}
        </div>

        {/* Inventory Valuation Schema Limitation Notice */}
        {selectedReport === 'INVENTORY_VALUATION' && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Inventory Valuation Schema Limitation</p>
              <p className="mt-0.5 leading-relaxed text-amber-800">
                Valuation reflects the current weighted-average cost state in the database. Historical point-in-time snapshot is not supported by the existing schema. The as-of date is recorded in the export audit trail.
              </p>
            </div>
          </div>
        )}

        {/* Profitability Notice */}
        {selectedReport === 'PROFITABILITY' && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Phase 2 Profitability Calculation Notice</p>
              <p className="mt-0.5 leading-relaxed text-amber-800">
                Phase 2 profitability accounts for sales revenue, operational expenses, and actual purchase costs recorded during this period. Recipe-level Cost of Goods Sold (COGS) will be introduced in Phase 3. This figure is an operational <strong>Estimate</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Filters Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedReport === 'INVENTORY_STOCK' || selectedReport === 'INVENTORY_VALUATION' ? (
            /* As-Of Date Filter */
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                As Of Operating Date *
              </label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="font-semibold text-forest-800 max-w-sm"
              />
            </div>
          ) : (
            /* Standard Date Range */
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Start Date *</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="font-semibold text-forest-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">End Date *</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="font-semibold text-forest-800"
                />
              </div>
            </>
          )}

          {/* Additional Backend-Supported Filters for Stock Movements */}
          {selectedReport === 'STOCK_MOVEMENTS' && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Inventory Item <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <Select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  options={[
                    { label: 'All Inventory Items', value: '' },
                    ...inventoryItems.map(i => ({ label: `${i.name} (${i.baseUnit || i.base_unit || ''})`, value: i.id }))
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Movement Type <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <Select
                  value={selectedMovementType}
                  onChange={(e) => setSelectedMovementType(e.target.value)}
                  options={[
                    { label: 'All Movement Types', value: '' },
                    { label: 'Opening Stock', value: 'OPENING' },
                    { label: 'Purchase Receipt', value: 'PURCHASE_RECEIPT' },
                    { label: 'Purchase Reversal', value: 'PURCHASE_REVERSAL' },
                    { label: 'Manual Increase', value: 'MANUAL_INCREASE' },
                    { label: 'Manual Decrease', value: 'MANUAL_DECREASE' },
                    { label: 'Wastage / Spoilage', value: 'WASTAGE' },
                    { label: 'Manual Consumption', value: 'MANUAL_CONSUMPTION' },
                    { label: 'Count Correction', value: 'COUNT_CORRECTION' }
                  ]}
                />
              </div>
            </>
          )}

          {/* Additional Backend-Supported Filters for Purchases */}
          {selectedReport === 'PURCHASES' && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Supplier <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <Select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  options={[
                    { label: 'All Suppliers', value: '' },
                    ...suppliers.map(s => ({ label: s.name, value: s.id }))
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Inventory Item <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <Select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  options={[
                    { label: 'All Inventory Items', value: '' },
                    ...inventoryItems.map(i => ({ label: i.name, value: i.id }))
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Payment Method <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <Select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  options={[
                    { label: 'All Payment Methods', value: '' },
                    { label: 'Cash', value: 'CASH' },
                    { label: 'UPI', value: 'UPI' },
                    { label: 'Card', value: 'CARD' },
                    { label: 'Credit', value: 'CREDIT' }
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Purchase Status <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <Select
                  value={selectedPurchaseStatus}
                  onChange={(e) => setSelectedPurchaseStatus(e.target.value)}
                  options={[
                    { label: 'All Statuses', value: '' },
                    { label: 'Received', value: 'RECEIVED' },
                    { label: 'Draft', value: 'DRAFT' },
                    { label: 'Reversed', value: 'REVERSED' }
                  ]}
                />
              </div>
            </>
          )}
        </div>

        {/* Step 3: Trigger Supported Exports (XLSX & PDF ONLY) and Preview */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-3 justify-end items-stretch sm:items-center">
          {selectedReportConfig?.isPhase3 && (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setPreviewModalOpen(true)}
              className="flex-1 sm:flex-none justify-center border-forest-700/30 text-forest-800 font-bold hover:bg-forest-50"
              icon={<Eye className="w-4 h-4 text-forest-800" />}
            >
              Preview Report Data
            </Button>
          )}

          <Button
            variant="secondary"
            size="lg"
            isLoading={exportingExcel}
            disabled={exportingPdf}
            onClick={() => handleExport('XLSX')}
            className="flex-1 sm:flex-none justify-center border-border font-bold text-slate-800"
            icon={<Download className="w-4 h-4 text-emerald-700" />}
          >
            Download XLSX Spreadsheet
          </Button>

          <Button
            variant="primary"
            size="lg"
            isLoading={exportingPdf}
            disabled={exportingExcel}
            onClick={() => handleExport('PDF')}
            className="flex-1 sm:flex-none justify-center shadow-md bg-forest-800 hover:bg-forest-900 font-bold"
            icon={<FileText className="w-4 h-4" />}
          >
            Download PDF Document
          </Button>
        </div>
      </Card>

      {/* Phase 3 Human-Readable Formatted Preview Modal */}
      {previewModalOpen && selectedReportConfig?.isPhase3 && (
        <ReportPreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          reportType={selectedReport as ReportTypeKey}
          reportTitle={selectedReportConfig.title}
          from={startDate}
          to={endDate}
          asOf={asOfDate}
          onExport={handleExport}
          isExporting={exportingExcel || exportingPdf}
        />
      )}
    </div>
  );
}
