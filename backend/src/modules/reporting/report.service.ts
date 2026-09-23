import { ExportRepository } from './export.repository';
import { SalesService } from '../sales/sales.service';
import { ExpenseService } from '../expense/expense.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { ValidationError } from '@/shared/errors';

export class ReportService {
  static async generateReportData(params: {
    reportType: 'DAILY_SALES' | 'MONTHLY_SALES' | 'ITEM_SALES' | 'CATEGORY_SALES' | 'EXPENSE_REPORT' | 'TRANSACTION_HISTORY' | 'RECONCILIATION';
    startDate: string;
    endDate: string;
  }) {
    if (!params.startDate || !params.endDate) {
      throw new ValidationError('Start date and end date are required.');
    }

    switch (params.reportType) {
      case 'DAILY_SALES':
      case 'MONTHLY_SALES':
      case 'ITEM_SALES':
      case 'CATEGORY_SALES':
        return SalesService.getSalesMetrics(params.startDate, params.endDate);
      case 'EXPENSE_REPORT':
        return ExpenseService.listExpenses({ startDate: params.startDate, endDate: params.endDate });
      case 'TRANSACTION_HISTORY':
        return BillingService.listBills({ startDate: params.startDate, endDate: params.endDate });
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
    let content: string | Buffer;
    if (params.fileFormat === 'EXCEL') {
      content = this.buildCsvExcelContent(metadata, reportData);
    } else {
      content = this.buildPdfContent(metadata, reportData);
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

  private static buildPdfContent(metadata: any, data: any): string {
    let pdfText = `%PDF-1.4 Header\n`;
    pdfText += `Koyal Kinare Cafe - Official Report\n`;
    pdfText += `Title: ${metadata.reportTitle}\n`;
    pdfText += `Date Range: ${metadata.appliedDateRange}\n`;
    pdfText += `Generated At: ${metadata.generatedAt}\n\n`;
    pdfText += `DATA SUMMARY:\n${JSON.stringify(data, null, 2)}\n`;
    return pdfText;
  }
}
