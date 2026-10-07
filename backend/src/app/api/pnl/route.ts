// GET /api/pnl?from=&to=
// Phase 3 Module 4 — Authoritative P&L endpoint.
// Returns grossRevenue, netSales, foodCost, grossProfit, operatingExpenses, netProfit,
// completeness model, and break-even. Uses ONLY historic transaction snapshots.

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

    const result = await AnalyticsService.getPnl(from, to);

    const duration = Date.now() - start;
    logger.info({
      requestId,
      reportType: 'PNL',
      from,
      to,
      duration,
      outcome: 'SUCCESS',
    }, 'P&L report generated');

    await AuditService.logEvent({
      adminId: admin.id,
      action: 'REPORT_VIEWED',
      entityType: 'PNL_REPORT',
      requestId,
      metadata: { from, to, duration },
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({ requestId, err }, 'P&L report request failed');
    return errorResponse(err, requestId);
  }
}
