import { NextRequest } from 'next/server';
import { AuthService } from '@/modules/auth/auth.service';
import { extractRawTokenFromHeader } from './session';
import { UnauthorizedError } from '../errors';

export async function requireAdmin(req: NextRequest): Promise<{ id: string; email: string; displayName: string }> {
  const rawToken = extractRawTokenFromHeader(req.headers.get('cookie'));
  if (!rawToken) {
    throw new UnauthorizedError('Unauthorized access');
  }
  const session = await AuthService.validateSessionToken(rawToken);
  return session.admin;
}
