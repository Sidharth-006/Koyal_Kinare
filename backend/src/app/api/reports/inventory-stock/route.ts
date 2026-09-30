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
    const asOf = searchParams.get('asOf') || undefined;
    const format = normalizeReportFormat(searchParams.get('format'));

    const reportData = await InventoryReportsService.getInventoryStockReport(asOf);

    const exportResult = await ReportService.requestExport(
      {
        reportType: 'INVENTORY_STOCK',
        asOf: reportData.asOfDate,
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
