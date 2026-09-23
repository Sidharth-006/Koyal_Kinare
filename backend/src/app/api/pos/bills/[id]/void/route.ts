import { NextRequest } from 'next/server';
import { BillingService } from '@/modules/billing/billing.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const updatedBill = await BillingService.voidBill(params.id, body.voidReason, admin.id);
    return successResponse({ bill: updatedBill });
  } catch (err) {
    return errorResponse(err);
  }
}
