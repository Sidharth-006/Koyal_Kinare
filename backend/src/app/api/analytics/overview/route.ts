// GET /api/analytics/overview?from=&to=
// Phase 3 Module 4 — Analytics overview endpoint.
// Returns authoritative trend/summary data and operational exceptions.

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

    const result = await AnalyticsService.getOverview(from, to);

    const duration = Date.now() - start;
    logger.info({ requestId, reportType: 'ANALYTICS_OVERVIEW', from, to, duration }, 'Analytics overview generated');

    await AuditService.logEvent({
      adminId: admin.id,
      action: 'REPORT_VIEWED',
      entityType: 'ANALYTICS_OVERVIEW',
      requestId,
      metadata: { from, to, duration },
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({ requestId, err }, 'Analytics overview request failed');
    return errorResponse(err, requestId);
  }
}
