import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { SupplierService } from '@/modules/supplier/supplier.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const supplier = await SupplierService.getSupplierById(params.id);

    logger.info({
      action: 'GET_SUPPLIER_DETAIL',
      supplierId: params.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ supplier }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'GET_SUPPLIER_DETAIL',
      supplierId: params.id,
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
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      body.idempotencyKey ||
      undefined;

    const supplier = await SupplierService.updateSupplier(
      params.id,
      { ...body, idempotencyKey },
      admin.id,
      requestId
    );

    logger.info({
      action: 'UPDATE_SUPPLIER',
      supplierId: params.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ supplier }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'UPDATE_SUPPLIER',
      supplierId: params.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
