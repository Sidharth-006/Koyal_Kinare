import { NextRequest } from 'next/server';
import { ReconciliationService } from '@/modules/reconciliation/reconciliation.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const settlement = await ReconciliationService.recordSettlement(body, admin.id);
    return successResponse({ settlement });
  } catch (err) {
    return errorResponse(err);
  }
}
