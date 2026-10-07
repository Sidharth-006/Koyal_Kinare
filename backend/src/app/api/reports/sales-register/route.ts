// GET /api/reports/sales-register?from=&to=&format=
// Phase 3 Module 4 — GST/CA Sales Register.
// When format=XLSX or format=PDF: returns export with audit trail.
// Without format: returns JSON report data directly.

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
      // Export path — validates format and generates file
      const exportResult = await PnlReportsService.exportSalesRegister(from, to, format, admin.id, requestId);
      logger.info({ requestId, reportType: 'SALES_REGISTER', from, to, format, duration: Date.now() - start }, 'Sales register exported');
      return successResponse(exportResult, 200, {}, requestId);
    }

    // JSON data path
    const result = await PnlReportsService.getSalesRegister(from, to);

    logger.info({ requestId, reportType: 'SALES_REGISTER', from, to, duration: Date.now() - start }, 'Sales register viewed');

    await AuditService.logEvent({
      adminId: admin.id,
      action: 'REPORT_VIEWED',
      entityType: 'SALES_REGISTER',
      requestId,
      metadata: { from, to },
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({ requestId, err }, 'Sales register request failed');
    return errorResponse(err, requestId);
  }
}
