import { NextRequest } from 'next/server';
import { AuthService } from '@/modules/auth/auth.service';
import { successResponse, errorResponse } from '@/shared/response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await AuthService.login(body);
    return successResponse(
      { admin: result.admin },
      200,
      { 'Set-Cookie': result.cookieHeader }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
