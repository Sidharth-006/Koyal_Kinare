import { NextRequest } from 'next/server';
import { SettingsService } from '@/modules/settings/settings.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const business = await SettingsService.getBusinessSettings();
    const targets = await SettingsService.getTargetSettings();
    const tax = await SettingsService.getTaxSettings();
    return successResponse({ settings: { business, targets, tax } });
  } catch (err) {
    return errorResponse(err);
  }
}
