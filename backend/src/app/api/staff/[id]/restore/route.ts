import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { StaffService } from '@/modules/staff/staff.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      body?.idempotencyKey ||
      undefined;

    const staff = await StaffService.restoreStaff(
      params.id,
      admin.id,
      requestId,
      idempotencyKey
    );

    logger.info({
      action: 'RESTORE_STAFF',
      staffId: staff.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ staff }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'RESTORE_STAFF',
      staffId: params.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
