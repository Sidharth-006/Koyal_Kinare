import { NextRequest } from 'next/server';
import { AuthService } from '@/modules/auth/auth.service';
import { extractRawTokenFromHeader } from '@/shared/auth/session';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawToken = extractRawTokenFromHeader(req.headers.get('cookie'));
    if (!rawToken) {
      return errorResponse({ message: 'Unauthorized access', code: 'UNAUTHORIZED', statusCode: 401 });
    }
    const session = await AuthService.validateSessionToken(rawToken);
    return successResponse({ admin: session.admin });
  } catch (err) {
    return errorResponse(err);
  }
}
