import { describe, it, expect } from 'vitest';
import { ReportService } from '@/modules/reporting/report.service';

describe('Report Export File Generation Integration Tests', () => {
  it('should require start and end dates for report export', async () => {
    await expect(
      ReportService.generateReportData({ reportType: 'DAILY_SALES', startDate: '', endDate: '' })
    ).rejects.toThrow('Start date and end date are required.');
  });

  it('should format CSV/Excel export content with metadata and headers', () => {
    const metadata = {
      reportTitle: 'DAILY_SALES (EXCEL)',
      appliedDateRange: '2026-09-01 to 2026-09-19',
      generatedAt: '2026-09-19T21:00:00.000Z'
    };
    const sampleData = [
      { item_name: 'Pani Puri', total_quantity: 50, total_revenue: '1500.00' },
      { item_name: 'Pav Bhaji', total_quantity: 30, total_revenue: '3600.00' }
    ];

    const content = (ReportService as any).buildCsvExcelContent(metadata, sampleData);
    expect(content).toContain('Koyal Kinare Cafe');
    expect(content).toContain('2026-09-01 to 2026-09-19');
    expect(content).toContain('item_name,total_quantity,total_revenue');
    expect(content).toContain('"Pani Puri","50","1500.00"');
  });

  it('should format PDF export content with summary details', async () => {
    const metadata = {
      reportTitle: 'EXPENSE_REPORT (PDF)',
      appliedDateRange: '2026-09-01 to 2026-09-19',
      generatedAt: '2026-09-19T21:00:00.000Z'
    };
    const sampleData = { totalExpenses: '4500.00', category: 'RAW_MATERIALS' };

    const content = await (ReportService as any).buildPdfContent(metadata, sampleData);
    const buffer = Buffer.from(content);
    expect(buffer.slice(0, 5).toString('utf-8')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
