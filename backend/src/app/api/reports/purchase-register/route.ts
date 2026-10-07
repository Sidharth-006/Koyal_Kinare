// GET /api/reports/purchase-register?from=&to=&format=
// Phase 3 Module 4 — GST/CA Purchase Register.
// Uses historic purchase_lines.tax_rate snapshots. Does NOT apply today's GST retrospectively.

import { NextRequest } from 'next/server';
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
      const exportResult = await PnlReportsService.exportPurchaseRegister(from, to, format, admin.id, requestId);
      logger.info({ requestId, reportType: 'PURCHASE_REGISTER', from, to, format, duration: Date.now() - start }, 'Purchase register exported');
      return successResponse(exportResult, 200, {}, requestId);
    }

    const result = await PnlReportsService.getPurchaseRegister(from, to);

    logger.info({ requestId, reportType: 'PURCHASE_REGISTER', from, to, duration: Date.now() - start }, 'Purchase register viewed');

    await AuditService.logEvent({
      adminId: admin.id,
      action: 'REPORT_VIEWED',
      entityType: 'PURCHASE_REGISTER',
      requestId,
      metadata: { from, to },
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({ requestId, err }, 'Purchase register request failed');
    return errorResponse(err, requestId);
  }
}
