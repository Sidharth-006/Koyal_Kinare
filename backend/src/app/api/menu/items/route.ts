import { NextRequest } from 'next/server';
import { MenuService } from '@/modules/menu/menu.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const includeArchived = req.nextUrl.searchParams.get('includeArchived') === 'true';
    const items = await MenuService.listMenuItems(includeArchived);
    return successResponse({ items });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const item = await MenuService.createMenuItem(body);
    return successResponse({ item }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
