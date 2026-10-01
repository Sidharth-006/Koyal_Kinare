import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { ReportService } from '@/modules/reporting/report.service';
import { normalizeReportFormat } from '@/modules/reporting/inventory-reports.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';
import { getTodayDateString } from '@/shared/time';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const searchParams = req.nextUrl.searchParams;
    const today = getTodayDateString();
    const from = searchParams.get('from') || today;
    const to = searchParams.get('to') || today;
    const staffId = searchParams.get('staffId') || undefined;
    const format = normalizeReportFormat(searchParams.get('format'));

    const exportResult = await ReportService.requestExport(
      {
        reportType: 'ATTENDANCE',
        startDate: from,
        endDate: to,
        staffId,
        fileFormat: format
      },
      admin.id,
      requestId
    );

    logger.info({
      action: 'EXPORT_ATTENDANCE_REPORT',
      from,
      to,
      staffId,
      format,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse(exportResult, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'EXPORT_ATTENDANCE_REPORT',
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
