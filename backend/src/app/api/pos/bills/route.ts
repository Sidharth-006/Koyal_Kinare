import { NextRequest } from 'next/server';
import { BillingService } from '@/modules/billing/billing.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const startDate = req.nextUrl.searchParams.get('startDate') || undefined;
    const endDate = req.nextUrl.searchParams.get('endDate') || undefined;
    const status = req.nextUrl.searchParams.get('status') || undefined;
    const bills = await BillingService.listBills({ startDate, endDate, status });
    return successResponse({ bills });
  } catch (err) {
    return errorResponse(err);
  }
}

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
