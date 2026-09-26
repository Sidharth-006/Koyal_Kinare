import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { PurchaseService } from '@/modules/purchases/purchases.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';
import { ValidationError } from '@/shared/errors';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);

    if (!params.id || !UUID_REGEX.test(params.id)) {
      throw new ValidationError('Invalid purchase ID format. Expected UUID.');
    }

    const purchase = await PurchaseService.getById(params.id);

    logger.info({
      action: 'GET_PURCHASE_DETAIL',
      purchaseId: params.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ purchase }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'GET_PURCHASE_DETAIL',
      purchaseId: params.id,
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

    if (!params.id || !UUID_REGEX.test(params.id)) {
      throw new ValidationError('Invalid purchase ID format. Expected UUID.');
    }

    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Request body must be a valid JSON object.');
    }

    if (body.purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.purchaseDate)) {
      throw new ValidationError('Invalid purchaseDate format. Expected YYYY-MM-DD.');
    }

    if (body.paymentMethod && !['CASH', 'UPI', 'CARD', 'CREDIT'].includes(body.paymentMethod)) {
      throw new ValidationError('Invalid paymentMethod. Allowed: CASH, UPI, CARD, CREDIT.');
    }

    if (body.lines !== undefined && (!Array.isArray(body.lines) || body.lines.length === 0)) {
      throw new ValidationError('If lines are provided, at least one line is required.');
    }

    const updated = await PurchaseService.updateDraft(
      params.id,
      {
        supplierId: body.supplierId !== undefined ? body.supplierId : undefined,
        adhocSupplierName: body.adhocSupplierName !== undefined ? body.adhocSupplierName : undefined,
        invoiceNumber: body.invoiceNumber !== undefined ? body.invoiceNumber : undefined,
        purchaseDate: body.purchaseDate,
        paymentMethod: body.paymentMethod,
        discount: body.discount,
        taxAmount: body.taxAmount,
        note: body.note,
        lines: body.lines
          ? body.lines.map((l: any) => ({
              inventoryItemId: l.inventoryItemId,
              quantity: l.quantity,
              unitRate: l.unitRate,
              lineDiscount: l.lineDiscount,
              taxRate: l.taxRate
            }))
          : undefined
      },
      admin.id,
      requestId
    );

    logger.info({
      action: 'UPDATE_PURCHASE_DRAFT',
      purchaseId: params.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ purchase: updated }, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'UPDATE_PURCHASE_DRAFT',
      purchaseId: params.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
