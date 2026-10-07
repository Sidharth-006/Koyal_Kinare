// GET /api/analytics/menu-performance?from=&to=&sort=
// Phase 3 Module 4 — Menu performance endpoint.
// Returns per-item sales, food cost, gross margin, completeness.
// sort must be one of: revenue | quantity | food_cost | gross_margin | food_cost_percent
// Invalid sort values are rejected with a 400 error.

import { NextRequest } from 'next/server';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
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
    const sort = searchParams.get('sort');

    // AnalyticsService.getMenuPerformance validates sort internally
    const result = await AnalyticsService.getMenuPerformance(from, to, sort);

    const duration = Date.now() - start;
    logger.info({ requestId, reportType: 'MENU_PERFORMANCE', from, to, sort, duration }, 'Menu performance report generated');

    await AuditService.logEvent({
      adminId: admin.id,
      action: 'REPORT_VIEWED',
      entityType: 'MENU_PERFORMANCE',
      requestId,
      metadata: { from, to, sort: result.appliedSort, duration },
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({ requestId, err }, 'Menu performance request failed');
    return errorResponse(err, requestId);
  }
}
