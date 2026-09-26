import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const stockSummary = await StockLedgerService.getItemStock(params.id);

    logger.info({
      action: 'GET_ITEM_STOCK',
      inventoryItemId: params.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse(stockSummary, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'GET_ITEM_STOCK',
      inventoryItemId: params.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
