import { NextRequest } from 'next/server';
import { MenuService } from '@/modules/menu/menu.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);
    const category = await MenuService.archiveCategory(params.id);
    return successResponse({ category });
  } catch (err) {
    return errorResponse(err);
  }
}
