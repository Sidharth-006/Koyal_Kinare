import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { PurchaseService } from '@/modules/purchases/purchases.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';
import { ValidationError } from '@/shared/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const searchParams = req.nextUrl.searchParams;

    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const supplierId = searchParams.get('supplierId') || undefined;
    const inventoryItemId = searchParams.get('inventoryItemId') || undefined;
    const paymentMethod = (searchParams.get('paymentMethod') as any) || undefined;
    const status = (searchParams.get('status') as any) || undefined;
    const page = searchParams.get('page') || undefined;
    const pageSize = searchParams.get('pageSize') || undefined;

    // Validate date format if provided (YYYY-MM-DD)
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new ValidationError('Invalid startDate format. Expected YYYY-MM-DD.');
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new ValidationError('Invalid endDate format. Expected YYYY-MM-DD.');
    }

    // Validate paymentMethod enum if provided
    if (paymentMethod && !['CASH', 'UPI', 'CARD', 'CREDIT'].includes(paymentMethod)) {
      throw new ValidationError('Invalid paymentMethod filter. Allowed: CASH, UPI, CARD, CREDIT.');
    }

    // Validate status enum if provided
    if (status && !['DRAFT', 'RECEIVED', 'REVERSED'].includes(status)) {
      throw new ValidationError('Invalid status filter. Allowed: DRAFT, RECEIVED, REVERSED.');
    }

    // Validate pagination boundaries
    if (page !== undefined && (isNaN(Number(page)) || Number(page) < 1)) {
      throw new ValidationError('Page must be a positive integer.');
    }
    if (pageSize !== undefined && (isNaN(Number(pageSize)) || Number(pageSize) < 1 || Number(pageSize) > 100)) {
      throw new ValidationError('PageSize must be between 1 and 100.');
    }

    const result = await PurchaseService.listPurchases({
      startDate,
      endDate,
      supplierId,
      inventoryItemId,
      paymentMethod,
      status,
      page,
      pageSize
    });

    logger.info({
      action: 'LIST_PURCHASES',
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'LIST_PURCHASES',
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

    // Basic request shape validation
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Request body must be a valid JSON object.');
    }

    if (!body.purchaseDate || typeof body.purchaseDate !== 'string') {
      throw new ValidationError('purchaseDate is required and must be a string (YYYY-MM-DD).');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.purchaseDate)) {
      throw new ValidationError('Invalid purchaseDate format. Expected YYYY-MM-DD.');
    }

    if (!body.paymentMethod || !['CASH', 'UPI', 'CARD', 'CREDIT'].includes(body.paymentMethod)) {
      throw new ValidationError('Valid paymentMethod is required (CASH, UPI, CARD, CREDIT).');
    }

    if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
      throw new ValidationError('Purchase must contain at least one line in the lines array.');
    }

    // Call service (service authoritatively validates items, suppliers, and calculates all totals)
    const purchase = await PurchaseService.createDraft(
      {
        supplierId: body.supplierId || null,
        adhocSupplierName: body.adhocSupplierName || null,
        invoiceNumber: body.invoiceNumber || null,
        purchaseDate: body.purchaseDate,
        paymentMethod: body.paymentMethod,
        discount: body.discount,
        taxAmount: body.taxAmount,
        note: body.note,
        lines: body.lines.map((l: any) => ({
          inventoryItemId: l.inventoryItemId,
          quantity: l.quantity,
          unitRate: l.unitRate,
          lineDiscount: l.lineDiscount,
          taxRate: l.taxRate
        }))
      },
      admin.id,
      requestId
    );

    logger.info({
      action: 'CREATE_PURCHASE_DRAFT',
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchase_number,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ purchase }, 201, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'CREATE_PURCHASE_DRAFT',
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
