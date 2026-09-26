import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';

export const dynamic = 'force-dynamic';

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

    const result = await StockLedgerService.recordStockCount(
      { ...body, idempotencyKey },
      admin.id,
      requestId
    );

    logger.info({
      action: 'RECORD_STOCK_COUNT',
      inventoryItemId: body.inventoryItemId,
      movementCreated: result.movementCreated,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse(result, 201, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'RECORD_STOCK_COUNT',
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
