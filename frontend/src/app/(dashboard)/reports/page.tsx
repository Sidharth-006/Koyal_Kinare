'use client';

import React, { useState } from 'react';
import { api, downloadExportFile } from '@/lib/api';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { BarChart3, ShoppingBag, Receipt, Scale, Download, FileText } from 'lucide-react';

const REPORT_TYPES = [
  {
    id: 'DAILY_SUMMARY',
    title: 'Daily Financial Summary',
    description: 'Overview of total sales, payment method breakdowns, discounts, tax, and voided transactions',
    icon: BarChart3
  },
  {
    id: 'ITEM_SALES',
    title: 'Item Sales Breakdown',
    description: 'Detailed quantities sold, revenue per menu item, and category sales performance',
    icon: ShoppingBag
  },
  {
    id: 'EXPENSE_REPORT',
    title: 'Operational Expense Audit',
    description: 'Comprehensive list of expenses categorized by raw material, utilities, salaries, and payment channels',
    icon: Receipt
  },
  {
    id: 'RECONCILIATION_REPORT',
    title: 'Daily Closing & Reconciliation',
    description: 'Audit logs of opening cash floats, register cash counts, digital settlements, and variances',
    icon: Scale
  }
];

export default function ReportsPage() {
  const { showToast } = useToast();

  const today = new Date().toISOString().split('T')[0];
  const [selectedReport, setSelectedReport] = useState('DAILY_SUMMARY');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExport = async (fileFormat: 'EXCEL' | 'PDF') => {
    if (!startDate || !endDate) {
      showToast('Please select both start and end dates', 'warning');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      showToast('Start date cannot be after end date', 'warning');
      return;
    }

    if (fileFormat === 'EXCEL') setExportingExcel(true);
    else setExportingPdf(true);

    try {
      const res = await api.exportReport({
        reportType: selectedReport,
        startDate,
        endDate,
        fileFormat
      });

      const ext = fileFormat === 'EXCEL' ? 'csv' : 'pdf';
      const filename = `${selectedReport.toLowerCase()}_${startDate}_to_${endDate}.${ext}`;

      downloadExportFile(res, filename);
      showToast(`Report downloaded successfully as ${ext.toUpperCase()}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate report export', 'error');
    } finally {
      setExportingExcel(false);
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      {/* Header */}
      <div className="pb-2 border-b border-border/60">
        <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight">Financial Reports & Data Exports</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">Generate and download CSV/Excel spreadsheets or printable PDF documents</p>
      </div>

      {/* Step 1: Select Report Type */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
          1. Select Report Type
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REPORT_TYPES.map((rpt) => {
            const isSelected = selectedReport === rpt.id;
            const Icon = rpt.icon;
            return (
              <div
                key={rpt.id}
                onClick={() => setSelectedReport(rpt.id)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 flex items-start gap-4 min-h-[105px] ${
                  isSelected
                    ? 'bg-white border-forest-800 shadow-card-hover ring-2 ring-forest-800/20'
                    : 'bg-white/70 border-border hover:border-forest-800/30 hover:bg-white'
                }`}
              >
                <div className={`p-3 rounded-2xl ${isSelected ? 'bg-forest-800 text-white' : 'bg-cream-100 text-forest-800'}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${isSelected ? 'text-forest-800' : 'text-slate-800'}`}>
                    {rpt.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed font-medium">
                    {rpt.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 2: Date Range & Trigger Export */}
      <Card className="space-y-5 border-border bg-white p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
          2. Select Date Range & Export Format
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>

        <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-3 justify-end">
          <Button
            variant="secondary"
            size="lg"
            isLoading={exportingExcel}
            disabled={exportingPdf}
            onClick={() => handleExport('EXCEL')}
            className="flex-1 sm:flex-none justify-center border-border"
            icon={<Download className="w-4 h-4 text-forest-800" />}
          >
            Download CSV / Excel
          </Button>

          <Button
            variant="primary"
            size="lg"
            isLoading={exportingPdf}
            disabled={exportingExcel}
            onClick={() => handleExport('PDF')}
            className="flex-1 sm:flex-none justify-center shadow-md bg-forest-800 hover:bg-forest-900"
            icon={<FileText className="w-4 h-4" />}
          >
            Download PDF Document
          </Button>
        </div>
      </Card>
    </div>
  );
}
