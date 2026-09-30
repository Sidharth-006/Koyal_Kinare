import { NextRequest } from 'next/server';
import { InventoryReportsService, normalizeReportFormat } from '@/modules/reporting/inventory-reports.service';
import { ReportService } from '@/modules/reporting/report.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const format = normalizeReportFormat(searchParams.get('format'));

    const reportData = await InventoryReportsService.getWastageReport({
      from,
      to
    });

    const exportResult = await ReportService.requestExport(
      {
        reportType: 'WASTAGE',
        startDate: from,
        endDate: to,
        fileFormat: format,
        reportData
      },
      admin.id
    );

    return successResponse(exportResult);
  } catch (err) {
    return errorResponse(err);
  }
}
