import { NextRequest } from 'next/server';
import { AuthService } from '@/modules/auth/auth.service';
import { successResponse, errorResponse } from '@/shared/response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userAgent = req.headers.get('user-agent') || undefined;
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.ip || undefined);

    const result = await AuthService.login(body, { userAgent, ip });
    return successResponse(
      { admin: result.admin, token: result.token },
      200,
      { 'Set-Cookie': result.cookieHeader }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
