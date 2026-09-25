import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { SupplierService } from '@/modules/supplier/supplier.service';
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

    const supplier = await SupplierService.restoreSupplier(
      params.id,
      admin.id,
      idempotencyKey,
      requestId
    );

    logger.info({
      action: 'RESTORE_SUPPLIER',
      supplierId: params.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ supplier }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'RESTORE_SUPPLIER',
      supplierId: params.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
