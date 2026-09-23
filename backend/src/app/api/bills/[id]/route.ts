import { NextRequest } from 'next/server';
import { BillingService } from '@/modules/billing/billing.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);
    const bill = await BillingService.getBillById(params.id);
    return successResponse({ bill });
  } catch (err) {
    return errorResponse(err);
  }
}
