import { NextRequest } from 'next/server';
import { DashboardService } from '@/modules/dashboard/dashboard.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const date = req.nextUrl.searchParams.get('date') || undefined;
    const metrics = await DashboardService.getDashboardMetrics(date);
    return successResponse({ metrics });
  } catch (err) {
    return errorResponse(err);
  }
}
