import { NextRequest } from 'next/server';
import { InventoryService } from '@/modules/inventory/inventory.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);
    const item = await InventoryService.getItemById(params.id);
    return successResponse({ item });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      body.idempotencyKey ||
      undefined;

    const item = await InventoryService.updateItem(
      params.id,
      { ...body, idempotencyKey },
      admin.id
    );
    return successResponse({ item });
  } catch (err) {
    return errorResponse(err);
  }
}
