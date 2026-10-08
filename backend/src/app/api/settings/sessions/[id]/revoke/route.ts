import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/shared/auth/guard';
import { verifyMutationOrigin } from '@/shared/auth/csrf';
import { checkRateLimit } from '@/shared/auth/rate-limiter';
import { DeviceSessionService } from '@/modules/auth/device-session.service';
import { createLogoutCookie } from '@/shared/auth/session';
import { successResponse, errorResponse } from '@/shared/response';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = crypto.randomUUID();
  try {
    verifyMutationOrigin(req);
    const { admin, sessionId } = await requireAdminSession(req);

    checkRateLimit(`admin_${admin.id}:session_revoke`, 30, 60000);

    const result = await DeviceSessionService.revokeSession(
      params.id,
      admin.id,
      sessionId,
      requestId
    );

    if (result.isCurrentSession) {
      const logoutCookie = createLogoutCookie();
      return successResponse(
        {
          message: 'Current session revoked. Signed out successfully.',
          isCurrentSession: true,
          loggedOut: true,
        },
        200,
        { 'Set-Cookie': logoutCookie },
        requestId
      );
    }

    return successResponse(
      {
        message: 'Session revoked successfully.',
        isCurrentSession: false,
        loggedOut: false,
      },
      200,
      {},
      requestId
    );
  } catch (err) {
    return errorResponse(err, requestId);
  }
}
