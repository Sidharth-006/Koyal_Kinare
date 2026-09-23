import { NextRequest } from 'next/server';
import { AuthService } from '@/modules/auth/auth.service';
import { extractRawTokenFromHeader } from '@/shared/auth/session';
import { successResponse, errorResponse } from '@/shared/response';

export async function POST(req: NextRequest) {
  try {
    const rawToken = extractRawTokenFromHeader(req.headers.get('cookie'));
    const logoutCookie = await AuthService.logout(rawToken);
    return successResponse(
      { message: 'Logged out successfully' },
      200,
      { 'Set-Cookie': logoutCookie }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
