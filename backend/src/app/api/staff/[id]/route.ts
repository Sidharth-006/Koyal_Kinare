import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { StaffService } from '@/modules/staff/staff.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const staff = await StaffService.getStaffById(params.id);

    logger.info({
      action: 'GET_STAFF_BY_ID',
      staffId: params.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ staff }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'GET_STAFF_BY_ID',
      staffId: params.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));

    const staff = await StaffService.updateStaff(
      params.id,
      {
        fullName: body.fullName !== undefined ? body.fullName : body.full_name,
        phone: body.phone,
        roleTitle: body.roleTitle !== undefined ? body.roleTitle : body.role_title,
        joiningDate: body.joiningDate !== undefined ? body.joiningDate : body.joining_date,
        emergencyContact: body.emergencyContact !== undefined ? body.emergencyContact : body.emergency_contact,
        salaryReference: body.salaryReference !== undefined ? body.salaryReference : body.salary_reference,
        notes: body.notes
      },
      admin.id,
      requestId
    );

    logger.info({
      action: 'UPDATE_STAFF',
      staffId: staff.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ staff }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'UPDATE_STAFF',
      staffId: params.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
