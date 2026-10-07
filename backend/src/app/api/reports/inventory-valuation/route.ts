// GET /api/reports/inventory-valuation?asOf=&format=
// Phase 3 Module 4 — Inventory Valuation Report.
// Reflects current moving-average inventory cost state with transparent schema limitation disclaimer.
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
    const asOf = searchParams.get('asOf') ?? undefined;
    const format = searchParams.get('format');

    if (format) {
      const exportResult = await PnlReportsService.exportInventoryValuation(asOf, format, admin.id, requestId);
      logger.info({ requestId, reportType: 'INVENTORY_VALUATION', asOf, format, duration: Date.now() - start }, 'Inventory valuation exported');
      return successResponse(exportResult, 200, {}, requestId);
    }

    const result = await AnalyticsService.getInventoryValuation(asOf);

    logger.info({ requestId, reportType: 'INVENTORY_VALUATION', asOf, duration: Date.now() - start }, 'Inventory valuation viewed');

    await AuditService.logEvent({
      adminId: admin.id,
      action: 'REPORT_VIEWED',
      entityType: 'INVENTORY_VALUATION',
      requestId,
      metadata: { asOf: result.asOfDate },
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({ requestId, err }, 'Inventory valuation request failed');
    return errorResponse(err, requestId);
  }
}
