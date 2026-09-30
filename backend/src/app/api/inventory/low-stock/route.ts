import { NextRequest } from 'next/server';
import { InventoryAlertsService } from '@/modules/inventory/inventory-alerts.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const result = await InventoryAlertsService.getLowStock(page, pageSize);
    return successResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
