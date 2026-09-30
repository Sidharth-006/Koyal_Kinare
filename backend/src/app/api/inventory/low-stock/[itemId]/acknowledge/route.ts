import { NextRequest } from 'next/server';
import { InventoryAlertsService } from '@/modules/inventory/inventory-alerts.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const acknowledgement = await InventoryAlertsService.acknowledgeAlert(
      params.itemId,
      body.note,
      admin.id
    );
    return successResponse({ acknowledgement });
  } catch (err) {
    return errorResponse(err);
  }
}
