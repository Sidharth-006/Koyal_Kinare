// GET /api/reports/expense-register?from=&to=&format=
// Phase 3 Module 4 — GST/CA Expense Register.
// When format is supplied: exports file (XLSX, EXCEL, PDF) with audit trail.
// Without format: returns JSON report data.

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
      const exportResult = await PnlReportsService.exportExpenseRegister(from, to, format, admin.id, requestId);
      logger.info({ requestId, reportType: 'EXPENSE_REGISTER', from, to, format, duration: Date.now() - start }, 'Expense register exported');
      return successResponse(exportResult, 200, {}, requestId);
    }

    const result = await PnlReportsService.getExpenseRegister(from, to);

    logger.info({ requestId, reportType: 'EXPENSE_REGISTER', from, to, duration: Date.now() - start }, 'Expense register viewed');

    await AuditService.logEvent({
      adminId: admin.id,
      action: 'REPORT_VIEWED',
      entityType: 'EXPENSE_REGISTER',
      requestId,
      metadata: { from, to },
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({ requestId, err }, 'Expense register request failed');
    return errorResponse(err, requestId);
  }
}
