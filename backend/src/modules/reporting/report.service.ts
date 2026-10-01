import { ExportRepository } from './export.repository';
import { SalesService } from '../sales/sales.service';
import { ExpenseService } from '../expense/expense.service';
import { BillingService } from '../billing/billing.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { InventoryReportsService } from './inventory-reports.service';
import { ProfitabilityService } from './profitability.service';
import { AuditService } from '../audit/audit.service';
import { PdfGenerator } from './pdf.generator';
import { AttendanceService } from '../attendance/attendance.service';
import { AttendanceRepository } from '../attendance/attendance.repository';
import { ValidationError } from '@/shared/errors';

export class ReportService {
  static async generateReportData(params: {
    reportType: string;
    startDate?: string;
    endDate?: string;
    asOf?: string;
    itemId?: string;
    supplierId?: string;
    staffId?: string;
    paymentMethod?: string;
    status?: string;
    movementType?: string;
  }) {
    const reportType = params.reportType?.toUpperCase();

    if (reportType === 'INVENTORY_STOCK') {
      return InventoryReportsService.getInventoryStockReport(params.asOf || params.startDate);
    }

    if (!params.startDate || !params.endDate) {
      throw new ValidationError('Start date and end date are required.');
    }

    switch (reportType) {
      case 'DAILY_SALES':
      case 'DAILY_SUMMARY':
      case 'MONTHLY_SALES':
      case 'ITEM_SALES':
      case 'CATEGORY_SALES':
        return SalesService.getSalesMetrics(params.startDate, params.endDate);
      case 'EXPENSE_REPORT':
        return ExpenseService.listExpenses({ startDate: params.startDate, endDate: params.endDate });
      case 'TRANSACTION_HISTORY':
        return BillingService.listBills({ startDate: params.startDate, endDate: params.endDate });
      case 'RECONCILIATION':
      case 'RECONCILIATION_REPORT':
        return ReconciliationService.getReconciliationPreview(params.startDate);
      case 'STOCK_MOVEMENTS':
        return InventoryReportsService.getStockMovementsReport({
          from: params.startDate,
          to: params.endDate,
          itemId: params.itemId,
          movementType: params.movementType
        });
      case 'PURCHASES':
      case 'PURCHASE_REPORT':
        return InventoryReportsService.getPurchasesReport({
          from: params.startDate,
          to: params.endDate,
          supplierId: params.supplierId,
          itemId: params.itemId,
          paymentMethod: params.paymentMethod,
          status: params.status
        });
      case 'SUPPLIERS':
      case 'SUPPLIER_REPORT':
        return InventoryReportsService.getSuppliersReport({
          from: params.startDate,
          to: params.endDate
        });
      case 'WASTAGE':
      case 'WASTAGE_REPORT':
        return InventoryReportsService.getWastageReport({
          from: params.startDate,
          to: params.endDate
        });
      case 'PROFITABILITY':
      case 'PROFITABILITY_PHASE_2':
      case 'PHASE_2_PROFITABILITY':
        return ProfitabilityService.getPhase2Profitability(params.startDate, params.endDate);
      case 'ATTENDANCE':
      case 'ATTENDANCE_REPORT': {
        const summary = await AttendanceService.getAttendanceSummary(params.startDate, params.endDate, params.staffId);
        const records = await AttendanceRepository.getAttendanceByDateRange(params.startDate, params.endDate, params.staffId);
        return {
          reportType: 'ATTENDANCE',
          summary: summary.metrics,
          staffSummaries: summary.staffSummaries,
          items: records.map(r => ({
            date: r.business_date,
            staffName: r.staff_name,
            roleTitle: r.staff_role_title,
            status: r.status,
            checkIn: r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
            checkOut: r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
            note: r.note || '-'
          }))
        };
      }
      default:
        return SalesService.getSalesMetrics(params.startDate, params.endDate);
    }
  }

  static async requestExport(
    params: {
      reportType: any;
      startDate?: string;
      endDate?: string;
      asOf?: string;
      itemId?: string;
      supplierId?: string;
      staffId?: string;
      paymentMethod?: string;
      status?: string;
      movementType?: string;
      fileFormat: 'EXCEL' | 'XLSX' | 'PDF';
      reportData?: any;
    },
    adminId: string,
    requestId?: string
  ) {
    const reportData = params.reportData || await this.generateReportData(params);
    const normalizedFormat = params.fileFormat.toUpperCase() === 'PDF' ? 'PDF' : 'EXCEL';

    const startDate = params.startDate || params.asOf || new Date().toISOString().slice(0, 10);
    const endDate = params.endDate || params.asOf || startDate;

    const job = await ExportRepository.createExportJob({
      reportType: params.reportType,
      startDate,
      endDate,
      fileFormat: normalizedFormat,
      requestedBy: adminId
    });

    const auditAction = params.reportType?.toUpperCase() === 'ATTENDANCE' ? 'ATTENDANCE_EXPORTED' : 'REPORT_EXPORTED';
    await AuditService.logEvent({
      adminId,
      action: auditAction,
      entityType: 'EXPORT_JOB',
      entityId: job.id,
      requestId,
      metadata: {
        reportType: params.reportType,
        fileFormat: params.fileFormat,
        dateRange: `${startDate} to ${endDate}`
      }
    });

    const metadata = {
      cafeName: 'Koyal Kinare Cafe',
      reportTitle: `${params.reportType} (${params.fileFormat})`,
      appliedDateRange: params.asOf ? `As of ${params.asOf}` : `${startDate} to ${endDate}`,
      generatedAt: new Date().toISOString(),
      format: params.fileFormat
    };

    let content: string | Buffer | Uint8Array;
    if (normalizedFormat === 'EXCEL') {
      content = this.buildCsvExcelContent(metadata, reportData);
    } else {
      content = await this.buildPdfContent(metadata, reportData);
    }

    return {
      job: { ...job, status: 'COMPLETED' },
      metadata,
      reportData,
      contentBuffer: Buffer.from(content).toString('base64'),
      mimeType: normalizedFormat === 'EXCEL' ? 'text/csv' : 'application/pdf'
    };
  }

  static buildCsvExcelContent(metadata: any, data: any): string {
    let csv = `Koyal Kinare Cafe - ${metadata.reportTitle}\n`;
    csv += `Date Range: ${metadata.appliedDateRange}\n`;
    csv += `Generated At: ${metadata.generatedAt}\n\n`;

    // 1. Data Quality note if present
    if (data && data.dataQualityNote) {
      csv += `Note: "${data.dataQualityNote}"\n\n`;
    }

    // 2. Summary key-value if present
    if (data && data.summary && typeof data.summary === 'object') {
      csv += `SUMMARY METRICS\n`;
      for (const [k, v] of Object.entries(data.summary)) {
        if (typeof v === 'object' && v !== null) {
          csv += `"${k}","${JSON.stringify(v)}"\n`;
        } else {
          csv += `"${k}","${v}"\n`;
        }
      }
      csv += `\n`;
    }

    // 3. Extract primary table array
    let tableArray: any[] | null = null;
    if (Array.isArray(data)) {
      tableArray = data;
    } else if (Array.isArray(data?.items)) {
      tableArray = data.items;
    } else if (Array.isArray(data?.movements)) {
      tableArray = data.movements;
    } else if (Array.isArray(data?.purchases)) {
      tableArray = data.purchases;
    } else if (Array.isArray(data?.suppliers)) {
      tableArray = data.suppliers;
    } else if (Array.isArray(data?.wastageItems)) {
      tableArray = data.wastageItems;
    }

    if (tableArray) {
      if (tableArray.length > 0) {
        const headers = Object.keys(tableArray[0]).join(',');
        csv += `${headers}\n`;
        for (const row of tableArray) {
          csv += Object.values(row).map(v => `"${v ?? ''}"`).join(',') + '\n';
        }
      } else {
        csv += `No records found for the selected criteria.\n`;
      }
    } else {
      for (const [key, val] of Object.entries(data)) {
        if (typeof val === 'object' && val !== null) {
          csv += `"${key}","${JSON.stringify(val)}"\n`;
        } else {
          csv += `"${key}","${val}"\n`;
        }
      }
    }
    return csv;
  }

  static async buildPdfContent(metadata: any, data: any): Promise<Uint8Array> {
    return PdfGenerator.generate(metadata, data);
  }
}
