import { NextRequest } from 'next/server';
import { SettingsService } from '@/modules/settings/settings.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const tax = await SettingsService.getTaxSettings();
    return successResponse({ tax });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const tax = await SettingsService.updateTaxSettings(body.enabled, body.label, body.rate, body.isInclusive, admin.id);
    return successResponse({ tax });
  } catch (err) {
    return errorResponse(err);
  }
}
