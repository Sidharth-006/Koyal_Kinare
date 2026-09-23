import { NextRequest } from 'next/server';
import { MenuService } from '@/modules/menu/menu.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const item = await MenuService.updateMenuItemAvailability(params.id, body.isAvailable);
    return successResponse({ item });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    const item = await MenuService.archiveMenuItem(params.id, admin.id);
    return successResponse({ item });
  } catch (err) {
    return errorResponse(err);
  }
}
