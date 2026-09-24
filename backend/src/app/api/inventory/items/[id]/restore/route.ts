import { NextRequest } from 'next/server';
import { InventoryService } from '@/modules/inventory/inventory.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      body?.idempotencyKey ||
      undefined;

    const item = await InventoryService.restoreItem(
      params.id,
      admin.id,
      idempotencyKey
    );
    return successResponse({ item });
  } catch (err) {
    return errorResponse(err);
  }
}
