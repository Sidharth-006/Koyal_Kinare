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
    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const page = searchParams.get('page') || undefined;
    const pageSize = searchParams.get('pageSize') || undefined;

    const summary = await SupplierService.getPurchaseSummary(params.id, {
      from,
      to,
      page,
      pageSize
    });

    logger.info({
      action: 'GET_SUPPLIER_PURCHASE_SUMMARY',
      supplierId: params.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse(summary, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'GET_SUPPLIER_PURCHASE_SUMMARY',
      supplierId: params.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
