import { NextRequest } from 'next/server';
import { InventoryAlertsService } from '@/modules/inventory/inventory-alerts.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const overview = await InventoryAlertsService.getOverview();
    return successResponse(overview);
  } catch (err) {
    return errorResponse(err);
  }
}
