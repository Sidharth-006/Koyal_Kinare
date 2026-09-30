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
    const supplierId = searchParams.get('supplierId') || undefined;
    const itemId = searchParams.get('itemId') || undefined;
    const paymentMethod = searchParams.get('paymentMethod') || undefined;
    const status = searchParams.get('status') || undefined;
    const format = normalizeReportFormat(searchParams.get('format'));

    const reportData = await InventoryReportsService.getPurchasesReport({
      from,
      to,
      supplierId,
      itemId,
      paymentMethod,
      status
    });

    const exportResult = await ReportService.requestExport(
      {
        reportType: 'PURCHASES',
        startDate: from,
        endDate: to,
        supplierId,
        itemId,
        paymentMethod,
        status,
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
