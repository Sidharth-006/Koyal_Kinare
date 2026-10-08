import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/shared/auth/guard';
import { verifyMutationOrigin } from '@/shared/auth/csrf';
import { checkRateLimit } from '@/shared/auth/rate-limiter';
import { DeviceSessionService } from '@/modules/auth/device-session.service';
import { successResponse, errorResponse } from '@/shared/response';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    verifyMutationOrigin(req);
    const { admin, sessionId } = await requireAdminSession(req);

    checkRateLimit(`admin_${admin.id}:session_revoke_others`, 10, 60000);

    const result = await DeviceSessionService.revokeOtherSessions(
      admin.id,
      sessionId,
      requestId
    );

    return successResponse(
      {
        message: 'All other sessions revoked successfully.',
        revokedCount: result.revokedCount,
      },
      200,
      {},
      requestId
    );
  } catch (err) {
    return errorResponse(err, requestId);
  }
}
