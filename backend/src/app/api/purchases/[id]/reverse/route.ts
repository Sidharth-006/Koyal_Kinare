import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { PurchaseService } from '@/modules/purchases/purchases.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';
import { ValidationError } from '@/shared/errors';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);

    if (!params.id || !UUID_REGEX.test(params.id)) {
      throw new ValidationError('Invalid purchase ID format. Expected UUID.');
    }

    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      undefined;

    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new ValidationError('Idempotency-Key header is required to reverse a purchase.');
    }

    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== 'object' || !body.reason || typeof body.reason !== 'string') {
      throw new ValidationError('A reversal reason string is required in request body.');
    }

    const reversed = await PurchaseService.reversePurchase(
      params.id,
      body.reason,
      admin.id,
      idempotencyKey.trim(),
      requestId
    );

    logger.info({
      action: 'REVERSE_PURCHASE',
      purchaseId: params.id,
      purchaseNumber: reversed.purchase_number,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ purchase: reversed }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'REVERSE_PURCHASE',
      purchaseId: params.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
