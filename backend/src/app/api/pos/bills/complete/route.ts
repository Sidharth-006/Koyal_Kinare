import { NextRequest } from 'next/server';
import { BillingService } from '@/modules/billing/billing.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key') || undefined;

    const bill = await BillingService.completeBill(
      { ...body, idempotencyKey },
      admin.id
    );
    return successResponse({ bill }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
