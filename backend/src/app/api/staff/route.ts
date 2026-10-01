import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { StaffService } from '@/modules/staff/staff.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || undefined;
    const roleTitle = searchParams.get('roleTitle') || searchParams.get('role') || undefined;
    const archived = searchParams.get('archived') || undefined;

    const staff = await StaffService.listStaff({
      search,
      roleTitle,
      archived
    });

    logger.info({
      action: 'LIST_STAFF',
      adminId: admin.id,
      requestId,
      count: staff.length,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ staff }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'LIST_STAFF',
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      body.idempotencyKey ||
      undefined;

    const staff = await StaffService.createStaff(
      {
        fullName: body.fullName || body.full_name,
        phone: body.phone,
        roleTitle: body.roleTitle || body.role_title,
        joiningDate: body.joiningDate || body.joining_date,
        emergencyContact: body.emergencyContact || body.emergency_contact,
        salaryReference: body.salaryReference ?? body.salary_reference,
        notes: body.notes,
        idempotencyKey
      },
      admin.id,
      requestId
    );

    logger.info({
      action: 'CREATE_STAFF',
      staffId: staff.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ staff }, 201, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'CREATE_STAFF',
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
