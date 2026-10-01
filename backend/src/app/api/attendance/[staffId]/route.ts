import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { AttendanceService } from '@/modules/attendance/attendance.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';
import { getTodayDateString } from '@/shared/time';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: { staffId: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const searchParams = req.nextUrl.searchParams;
    const date = searchParams.get('date') || getTodayDateString();
    const body = await req.json().catch(() => ({}));

    const record = await AttendanceService.saveSingleAttendance(
      params.staffId,
      date,
      {
        status: body.status,
        checkInAt: body.checkInAt !== undefined ? body.checkInAt : body.check_in_at,
        checkOutAt: body.checkOutAt !== undefined ? body.checkOutAt : body.check_out_at,
        note: body.note,
        expectedUpdatedAt: body.expectedUpdatedAt !== undefined ? body.expectedUpdatedAt : body.expected_updated_at
      },
      admin.id,
      requestId
    );

    logger.info({
      action: 'SAVE_SINGLE_ATTENDANCE',
      staffId: params.staffId,
      date,
      status: record.status,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ record }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'SAVE_SINGLE_ATTENDANCE',
      staffId: params.staffId,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
