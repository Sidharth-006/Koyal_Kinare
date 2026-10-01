import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { AttendanceService } from '@/modules/attendance/attendance.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';
import { getTodayDateString } from '@/shared/time';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const searchParams = req.nextUrl.searchParams;
    const date = searchParams.get('date') || getTodayDateString();
    const body = await req.json().catch(() => ({}));
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      body?.idempotencyKey ||
      undefined;

    const entries = Array.isArray(body.entries) ? body.entries.map((e: any) => ({
      staffId: e.staffId || e.staff_id,
      status: e.status,
      checkInAt: e.checkInAt !== undefined ? e.checkInAt : e.check_in_at,
      checkOutAt: e.checkOutAt !== undefined ? e.checkOutAt : e.check_out_at,
      note: e.note
    })) : [];

    const result = await AttendanceService.bulkSaveAttendance(
      date,
      { entries },
      admin.id,
      requestId,
      idempotencyKey
    );

    logger.info({
      action: 'BULK_SAVE_ATTENDANCE',
      date,
      count: result.totalSaved,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'BULK_SAVE_ATTENDANCE',
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
