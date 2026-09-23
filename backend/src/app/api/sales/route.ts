import { NextRequest } from 'next/server';
import { SalesService } from '@/modules/sales/sales.service';
import { requireAdmin } from '@/shared/auth/guard';
import { getTodayDateString } from '@/shared/time';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const startDate = req.nextUrl.searchParams.get('startDate') || getTodayDateString();
    const endDate = req.nextUrl.searchParams.get('endDate') || getTodayDateString();
    const sales = await SalesService.getSalesMetrics(startDate, endDate);
    return successResponse({ sales });
  } catch (err) {
    return errorResponse(err);
  }
}
