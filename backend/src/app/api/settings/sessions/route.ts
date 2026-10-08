import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/shared/auth/guard';
import { DeviceSessionService } from '@/modules/auth/device-session.service';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { admin, sessionId } = await requireAdminSession(req);
    const sessions = await DeviceSessionService.listSessions(admin.id, sessionId);
    return successResponse({ sessions });
  } catch (err) {
    return errorResponse(err);
  }
}
