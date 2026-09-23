import { NextRequest } from 'next/server';
import { SettingsService } from '@/modules/settings/settings.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const targets = await SettingsService.getTargetSettings();
    return successResponse({ targets });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const targets = await SettingsService.updateTargetSettings(body.dailySalesTarget, body.monthlySalesTarget, admin.id);
    return successResponse({ targets });
  } catch (err) {
    return errorResponse(err);
  }
}
