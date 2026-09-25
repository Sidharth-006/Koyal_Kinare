import { ExportRepository } from './export.repository';
import { SalesService } from '../sales/sales.service';
import { ExpenseService } from '../expense/expense.service';
import { BillingService } from '../billing/billing.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { AuditService } from '../audit/audit.service';
import { PdfGenerator } from './pdf.generator';
import { ValidationError } from '@/shared/errors';

export class ReportService {
  static async generateReportData(params: {
    reportType: string;
    startDate: string;
    endDate: string;
  }) {
    if (!params.startDate || !params.endDate) {
      throw new ValidationError('Start date and end date are required.');
    }

    switch (params.reportType) {
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
      default:
        return SalesService.getSalesMetrics(params.startDate, params.endDate);
    }
  }

  static async requestExport(params: {
    reportType: any;
    startDate: string;
    endDate: string;
    fileFormat: 'EXCEL' | 'PDF';
  }, adminId: string, requestId?: string) {
    const reportData = await this.generateReportData(params);

    const job = await ExportRepository.createExportJob({
      reportType: params.reportType,
      startDate: params.startDate,
      endDate: params.endDate,
      fileFormat: params.fileFormat,
      requestedBy: adminId
    });

    await AuditService.logEvent({
      adminId,
      action: 'REPORT_EXPORTED',
      entityType: 'EXPORT_JOB',
      entityId: job.id,
      requestId,
      metadata: { reportType: params.reportType, fileFormat: params.fileFormat }
    });

    const metadata = {
      cafeName: 'Koyal Kinare Cafe',
      reportTitle: `${params.reportType} (${params.fileFormat})`,
      appliedDateRange: `${params.startDate} to ${params.endDate}`,
      generatedAt: new Date().toISOString(),
      format: params.fileFormat
    };

    // Format export buffer content
    let content: string | Buffer | Uint8Array;
    if (params.fileFormat === 'EXCEL') {
      content = this.buildCsvExcelContent(metadata, reportData);
    } else {
      content = await this.buildPdfContent(metadata, reportData);
    }

    return {
      job: { ...job, status: 'COMPLETED' },
      metadata,
      reportData,
      contentBuffer: Buffer.from(content).toString('base64'),
      mimeType: params.fileFormat === 'EXCEL' ? 'text/csv' : 'application/pdf'
    };
  }

  private static buildCsvExcelContent(metadata: any, data: any): string {
    let csv = `Koyal Kinare Cafe - ${metadata.reportTitle}\n`;
    csv += `Date Range: ${metadata.appliedDateRange}\n`;
    csv += `Generated At: ${metadata.generatedAt}\n\n`;

    if (Array.isArray(data)) {
      if (data.length > 0) {
        const headers = Object.keys(data[0]).join(',');
        csv += `${headers}\n`;
        for (const row of data) {
          csv += Object.values(row).map(v => `"${v ?? ''}"`).join(',') + '\n';
        }
      } else {
        csv += `No transactions found.\n`;
      }
    } else {
      for (const [key, val] of Object.entries(data)) {
        if (typeof val === 'object') continue;
        csv += `"${key}","${val}"\n`;
      }
    }
    return csv;
  }

  private static async buildPdfContent(metadata: any, data: any): Promise<Uint8Array> {
    return PdfGenerator.generate(metadata, data);
  }
}
