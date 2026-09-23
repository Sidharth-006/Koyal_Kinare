import { NextRequest } from 'next/server';
import { ReconciliationService } from '@/modules/reconciliation/reconciliation.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const date = req.nextUrl.searchParams.get('businessDate') || undefined;
    const preview = await ReconciliationService.getReconciliationPreview(date);
    return successResponse({ reconciliation: preview });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const closing = await ReconciliationService.finalizeDailyClosing(body, admin.id);
    return successResponse({ closing });
  } catch (err) {
    return errorResponse(err);
  }
}
