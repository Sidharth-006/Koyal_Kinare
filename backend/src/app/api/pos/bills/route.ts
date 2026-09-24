import { NextRequest } from 'next/server';
import { BillingService } from '@/modules/billing/billing.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const getCleanParam = (key: string) => {
      const val = req.nextUrl.searchParams.get(key);
      return (!val || val === 'undefined' || val === 'null') ? undefined : val;
    };
    const startDate = getCleanParam('startDate');
    const endDate = getCleanParam('endDate');
    const status = getCleanParam('status');
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
