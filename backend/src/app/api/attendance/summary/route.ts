import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { AttendanceService } from '@/modules/attendance/attendance.service';
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

    const summary = await AttendanceService.getAttendanceSummary(from, to, staffId);

    logger.info({
      action: 'GET_ATTENDANCE_SUMMARY',
      from,
      to,
      staffId,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse(summary, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'GET_ATTENDANCE_SUMMARY',
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
