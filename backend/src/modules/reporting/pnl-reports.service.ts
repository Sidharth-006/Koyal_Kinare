// pnl-reports.service.ts — Phase 3 Module 4
// Service layer for CA registers: sales, purchase, expense.
// Formats raw DB rows into typed, auditable report responses.
// READ ONLY — does NOT mutate any operational data.

import { PnlReportsRepository } from './pnl-reports.repository';
import { SettingsRepository } from '../settings/settings.repository';
import { AuditService } from '../audit/audit.service';
import { ReportService } from './report.service';
import { validateDateRange } from './inventory-reports.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { toDecimal } from '@/shared/money/decimal';
import { logger } from '@/shared/logging/logger';
import { ValidationError } from '@/shared/errors';
import {
  SalesRegisterResult,
  SalesRegisterRow,
  PurchaseRegisterResult,
  PurchaseRegisterRow,
  ExpenseRegisterResult,
  ExpenseRegisterRow,
} from '../analytics/analytics.types';

// ============================================================
// HELPERS
// ============================================================

function getReportedAt(): string {
  return new Date().toISOString();
}

function getTimezone(): string {
  return 'Asia/Kolkata';
}

function normalizeDateStr(d: any): string {
  if (!d) return '';
  return typeof d === 'string' ? d.substring(0, 10) : new Date(d).toISOString().substring(0, 10);
}

export function normalizeExportFormat(format: string | null | undefined): 'XLSX' | 'EXCEL' | 'PDF' {
  if (!format) {
    throw new ValidationError('Report format is required (XLSX, EXCEL, or PDF).');
  }
  const upper = format.trim().toUpperCase();
  if (upper !== 'XLSX' && upper !== 'EXCEL' && upper !== 'PDF') {
    throw new ValidationError('Invalid format. Supported formats are XLSX, EXCEL, and PDF.');
  }
  return upper as 'XLSX' | 'EXCEL' | 'PDF';
}

// ============================================================
// SALES REGISTER SERVICE
// ============================================================

export class PnlReportsService {
  static async getSalesRegister(from: string, to: string): Promise<SalesRegisterResult> {
    validateDateRange(from, to);

    const [businessSettings, rows, summary] = await Promise.all([
      SettingsRepository.getBusinessSettings(),
      PnlReportsRepository.getSalesRegister(from, to),
      PnlReportsRepository.getSalesRegisterSummary(from, to),
    ]);

    const items: SalesRegisterRow[] = rows.map((r: any) => {
      const payments: Array<{ method: string; amount: string }> = r.payments_json
        ? r.payments_json.map((p: any) => ({ method: p.method, amount: p.amount }))
        : [];

      return {
        billId: r.bill_id,
        billNumber: r.bill_number,
        businessDate: normalizeDateStr(r.business_date),
        orderType: r.order_type,
        subtotal: toDecimal(r.subtotal).toFixed(2),
        discount: toDecimal(r.discount).toFixed(2),
        tax: toDecimal(r.tax).toFixed(2),
        grandTotal: toDecimal(r.grand_total).toFixed(2),
        taxRateSnapshot: r.tax_rate_snapshot !== null ? String(r.tax_rate_snapshot) : null,
        payments,
        status: r.status,
        completedAt: r.completed_at,
      };
    });

    const grossRevenue = toDecimal(summary.total_gross_revenue);
    const totalDiscounts = toDecimal(summary.total_discounts);
    const totalTax = toDecimal(summary.total_tax);
    const totalNetSales = grossRevenue.minus(totalDiscounts).minus(totalTax);

    return {
      reportType: 'SALES_REGISTER',
      dateRange: { from, to },
      reportedAt: getReportedAt(),
      cafeIdentity: {
        cafeName: businessSettings.cafe_name,
        currency: businessSettings.currency,
      },
      timezone: getTimezone(),
      summary: {
        totalBills: parseInt(summary.total_bills ?? '0', 10),
        completedBills: parseInt(summary.completed_bills ?? '0', 10),
        voidedBills: parseInt(summary.voided_bills ?? '0', 10),
        totalGrossRevenue: grossRevenue.toFixed(2),
        totalDiscounts: totalDiscounts.toFixed(2),
        totalTax: totalTax.toFixed(2),
        totalNetSales: totalNetSales.toFixed(2),
      },
      items,
    };
  }

  // ============================================================
  // PURCHASE REGISTER SERVICE
  // ============================================================

  static async getPurchaseRegister(from: string, to: string): Promise<PurchaseRegisterResult> {
    validateDateRange(from, to);

    const [businessSettings, rows, summary] = await Promise.all([
      SettingsRepository.getBusinessSettings(),
      PnlReportsRepository.getPurchaseRegister(from, to),
      PnlReportsRepository.getPurchaseRegisterSummary(from, to),
    ]);

    const items: PurchaseRegisterRow[] = rows.map((r: any) => ({
      purchaseId: r.purchase_id,
      purchaseNumber: r.purchase_number,
      supplierName: r.supplier_name,
      invoiceNumber: r.invoice_number || null,
      purchaseDate: normalizeDateStr(r.purchase_date),
      paymentMethod: r.payment_method,
      discount: toDecimal(r.discount).toFixed(2),
      taxAmount: toDecimal(r.tax_amount).toFixed(2),
      taxRateSnapshot: r.tax_rate_snapshot !== null ? toDecimal(r.tax_rate_snapshot).toFixed(2) : null,
      grandTotal: toDecimal(r.grand_total).toFixed(2),
      status: r.status,
      receivedAt: r.received_at || null,
    }));

    return {
      reportType: 'PURCHASE_REGISTER',
      dateRange: { from, to },
      reportedAt: getReportedAt(),
      cafeIdentity: {
        cafeName: businessSettings.cafe_name,
        currency: businessSettings.currency,
      },
      timezone: getTimezone(),
      summary: {
        totalPurchases: parseInt(summary.total_purchases ?? '0', 10),
        receivedTotal: toDecimal(summary.received_total).toFixed(2),
        taxTotal: toDecimal(summary.tax_total).toFixed(2),
        discountTotal: toDecimal(summary.discount_total).toFixed(2),
      },
      items,
    };
  }

  // ============================================================
  // EXPENSE REGISTER SERVICE
  // ============================================================

  static async getExpenseRegister(from: string, to: string): Promise<ExpenseRegisterResult> {
    validateDateRange(from, to);

    const [businessSettings, rows, summary, byCategory] = await Promise.all([
      SettingsRepository.getBusinessSettings(),
      PnlReportsRepository.getExpenseRegister(from, to),
      PnlReportsRepository.getExpenseRegisterSummary(from, to),
      PnlReportsRepository.getExpenseRegisterByCategory(from, to),
    ]);

    const items: ExpenseRegisterRow[] = rows.map((r: any) => ({
      expenseId: r.expense_id,
      businessDate: normalizeDateStr(r.business_date),
      category: r.category,
      amount: toDecimal(r.amount).toFixed(2),
      paymentMethod: r.payment_method,
      description: r.description || '',
      attachmentRef: r.attachment_id
        ? `attachment:${r.attachment_id}:${r.attachment_file_name}`
        : null,
      isVoided: r.is_voided,
      voidReason: r.void_reason || null,
      createdAt: r.created_at,
    }));

    return {
      reportType: 'EXPENSE_REGISTER',
      dateRange: { from, to },
      reportedAt: getReportedAt(),
      cafeIdentity: {
        cafeName: businessSettings.cafe_name,
        currency: businessSettings.currency,
      },
      timezone: getTimezone(),
      summary: {
        totalExpenses: parseInt(summary.total_expenses ?? '0', 10),
        activeTotal: toDecimal(summary.active_total).toFixed(2),
        voidedCount: parseInt(summary.voided_count ?? '0', 10),
        byCategory: byCategory.map((r: any) => ({
          category: r.category,
          total: String(r.total),
        })),
      },
      items,
    };
  }

  // ============================================================
  // EXPORT HELPERS (reuse existing ReportService pattern)
  // ============================================================

  static async exportSalesRegister(
    from: string,
    to: string,
    format: string,
    adminId: string,
    requestId?: string,
  ) {
    const normalizedFormat = normalizeExportFormat(format);
    const reportData = await this.getSalesRegister(from, to);

    logger.info({
      reportType: 'SALES_REGISTER',
      from,
      to,
      format: normalizedFormat,
      requestId,
    }, 'Sales register export initiated');

    const result = await ReportService.requestExport(
      {
        reportType: 'SALES_REGISTER',
        startDate: from,
        endDate: to,
        fileFormat: normalizedFormat === 'PDF' ? 'PDF' : 'EXCEL',
        reportData: { ...reportData, items: reportData.items },
      },
      adminId,
      requestId,
    );

    await AuditService.logEvent({
      adminId,
      action: 'REPORT_EXPORTED',
      entityType: 'EXPORT_JOB',
      entityId: result.job.id,
      requestId,
      metadata: {
        reportType: 'SALES_REGISTER',
        format: normalizedFormat,
        dateRange: `${from} to ${to}`,
      },
    });

    return result;
  }

  static async exportPurchaseRegister(
    from: string,
    to: string,
    format: string,
    adminId: string,
    requestId?: string,
  ) {
    const normalizedFormat = normalizeExportFormat(format);
    const reportData = await this.getPurchaseRegister(from, to);

    logger.info({
      reportType: 'PURCHASE_REGISTER',
      from,
      to,
      format: normalizedFormat,
      requestId,
    }, 'Purchase register export initiated');

    const result = await ReportService.requestExport(
      {
        reportType: 'PURCHASE_REGISTER',
        startDate: from,
        endDate: to,
        fileFormat: normalizedFormat === 'PDF' ? 'PDF' : 'EXCEL',
        reportData: { ...reportData, items: reportData.items },
      },
      adminId,
      requestId,
    );

    await AuditService.logEvent({
      adminId,
      action: 'REPORT_EXPORTED',
      entityType: 'EXPORT_JOB',
      entityId: result.job.id,
      requestId,
      metadata: {
        reportType: 'PURCHASE_REGISTER',
        format: normalizedFormat,
        dateRange: `${from} to ${to}`,
      },
    });

    return result;
  }

  static async exportExpenseRegister(
    from: string,
    to: string,
    format: string,
    adminId: string,
    requestId?: string,
  ) {
    const normalizedFormat = normalizeExportFormat(format);
    const reportData = await this.getExpenseRegister(from, to);

    logger.info({
      reportType: 'EXPENSE_REGISTER',
      from,
      to,
      format: normalizedFormat,
      requestId,
    }, 'Expense register export initiated');

    const result = await ReportService.requestExport(
      {
        reportType: 'EXPENSE_REGISTER',
        startDate: from,
        endDate: to,
        fileFormat: normalizedFormat === 'PDF' ? 'PDF' : 'EXCEL',
        reportData: { ...reportData, items: reportData.items },
      },
      adminId,
      requestId,
    );

    await AuditService.logEvent({
      adminId,
      action: 'REPORT_EXPORTED',
      entityType: 'EXPORT_JOB',
      entityId: result.job.id,
      requestId,
      metadata: {
        reportType: 'EXPENSE_REGISTER',
        format: normalizedFormat,
        dateRange: `${from} to ${to}`,
      },
    });

    return result;
  }

  static async exportMonthlyPnl(
    from: string,
    to: string,
    format: string,
    adminId: string,
    requestId?: string,
  ) {
    const normalizedFormat = normalizeExportFormat(format);
    const reportData = await AnalyticsService.getMonthlyPnl(from, to);

    logger.info({
      reportType: 'MONTHLY_PNL',
      from,
      to,
      format: normalizedFormat,
      requestId,
    }, 'Monthly P&L export initiated');

    const result = await ReportService.requestExport(
      {
        reportType: 'MONTHLY_PNL',
        startDate: from,
        endDate: to,
        fileFormat: normalizedFormat === 'PDF' ? 'PDF' : 'EXCEL',
        reportData: { ...reportData, items: reportData.months },
      },
      adminId,
      requestId,
    );

    await AuditService.logEvent({
      adminId,
      action: 'REPORT_EXPORTED',
      entityType: 'EXPORT_JOB',
      entityId: result.job.id,
      requestId,
      metadata: {
        reportType: 'MONTHLY_PNL',
        format: normalizedFormat,
        dateRange: `${from} to ${to}`,
      },
    });

    return result;
  }

  static async exportInventoryValuation(
    asOf: string | undefined,
    format: string,
    adminId: string,
    requestId?: string,
  ) {
    const normalizedFormat = normalizeExportFormat(format);
    const reportData = await AnalyticsService.getInventoryValuation(asOf);

    logger.info({
      reportType: 'INVENTORY_VALUATION',
      asOf: reportData.asOfDate,
      format: normalizedFormat,
      requestId,
    }, 'Inventory valuation export initiated');

    const result = await ReportService.requestExport(
      {
        reportType: 'INVENTORY_VALUATION',
        asOf: reportData.asOfDate,
        fileFormat: normalizedFormat === 'PDF' ? 'PDF' : 'EXCEL',
        reportData: { ...reportData, items: reportData.items },
      },
      adminId,
      requestId,
    );

    await AuditService.logEvent({
      adminId,
      action: 'REPORT_EXPORTED',
      entityType: 'EXPORT_JOB',
      entityId: result.job.id,
      requestId,
      metadata: {
        reportType: 'INVENTORY_VALUATION',
        format: normalizedFormat,
        asOf: reportData.asOfDate,
      },
    });

    return result;
  }

  static async exportReconciliation(
    from: string,
    to: string,
    format: string,
    adminId: string,
    requestId?: string,
  ) {
    const normalizedFormat = normalizeExportFormat(format);
    const reportData = await AnalyticsService.getReconciliationRange(from, to);

    logger.info({
      reportType: 'RECONCILIATION',
      from,
      to,
      format: normalizedFormat,
      requestId,
    }, 'Reconciliation export initiated');

    const result = await ReportService.requestExport(
      {
        reportType: 'RECONCILIATION',
        startDate: from,
        endDate: to,
        fileFormat: normalizedFormat === 'PDF' ? 'PDF' : 'EXCEL',
        reportData: { ...reportData, items: reportData.days },
      },
      adminId,
      requestId,
    );

    await AuditService.logEvent({
      adminId,
      action: 'REPORT_EXPORTED',
      entityType: 'EXPORT_JOB',
      entityId: result.job.id,
      requestId,
      metadata: {
        reportType: 'RECONCILIATION',
        format: normalizedFormat,
        dateRange: `${from} to ${to}`,
      },
    });

    return result;
  }
}
