import { NextRequest } from 'next/server';
import { InventoryService } from '@/modules/inventory/inventory.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || undefined;
    const type = (searchParams.get('type') as any) || undefined;
    const status = (searchParams.get('status') as any) || undefined;
    const page = searchParams.get('page') || undefined;
    const pageSize = searchParams.get('pageSize') || undefined;

    const result = await InventoryService.listItems({ search, type, status, page, pageSize });
    return successResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      body.idempotencyKey ||
      undefined;

    const item = await InventoryService.createItem(
      { ...body, idempotencyKey },
      admin.id
    );
    return successResponse({ item }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
