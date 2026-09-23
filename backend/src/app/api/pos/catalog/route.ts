import { NextRequest } from 'next/server';
import { MenuService } from '@/modules/menu/menu.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const categories = await MenuService.listCategories(false);
    const items = await MenuService.listMenuItems(false);
    const tables = await MenuService.listTables();
    return successResponse({ catalog: { categories, items, tables } });
  } catch (err) {
    return errorResponse(err);
  }
}
