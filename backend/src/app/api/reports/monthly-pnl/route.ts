// GET /api/reports/monthly-pnl?from=&to=&format=
// Phase 3 Module 4 — Monthly Grouped P&L Report.
// When format is supplied: exports file (XLSX, EXCEL, PDF) with audit trail.
// Without format: returns JSON report data.

import { NextRequest } from 'next/server';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { PnlReportsService } from '@/modules/reporting/pnl-reports.service';
import { AuditService } from '@/modules/audit/audit.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  try {
    const admin = await requireAdmin(req);
    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get('from') ?? '';
    const to = searchParams.get('to') ?? '';
    const format = searchParams.get('format');

    if (format) {
      const exportResult = await PnlReportsService.exportMonthlyPnl(from, to, format, admin.id, requestId);
      logger.info({ requestId, reportType: 'MONTHLY_PNL', from, to, format, duration: Date.now() - start }, 'Monthly P&L exported');
      return successResponse(exportResult, 200, {}, requestId);
    }

    const result = await AnalyticsService.getMonthlyPnl(from, to);

    logger.info({ requestId, reportType: 'MONTHLY_PNL', from, to, duration: Date.now() - start }, 'Monthly P&L viewed');

    await AuditService.logEvent({
      adminId: admin.id,
      action: 'REPORT_VIEWED',
      entityType: 'MONTHLY_PNL',
      requestId,
      metadata: { from, to },
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({ requestId, err }, 'Monthly P&L request failed');
    return errorResponse(err, requestId);
  }
}
