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
    const date = searchParams.get('date') || getTodayDateString();

    const roster = await AttendanceService.getDailyAttendanceRoster(date);

    logger.info({
      action: 'GET_DAILY_ATTENDANCE',
      adminId: admin.id,
      date,
      count: roster.length,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ date, roster }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'GET_DAILY_ATTENDANCE',
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
