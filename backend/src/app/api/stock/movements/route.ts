import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { StockMovementType } from '@/modules/stock/stock.types';
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

    const itemId = searchParams.get('itemId') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const type = (searchParams.get('type') as StockMovementType) || undefined;
    const page = searchParams.get('page') || undefined;
    const pageSize = searchParams.get('pageSize') || undefined;

    const result = await StockLedgerService.listMovements({
      itemId,
      from,
      to,
      type,
      page,
      pageSize
    });

    logger.info({
      action: 'LIST_STOCK_MOVEMENTS',
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'LIST_STOCK_MOVEMENTS',
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
