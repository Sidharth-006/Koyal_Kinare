import { NextRequest } from 'next/server';
import { MenuService } from '@/modules/menu/menu.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    const item = await MenuService.restoreMenuItem(params.id, admin.id);
    return successResponse({ item });
  } catch (err) {
    return errorResponse(err);
  }
}
