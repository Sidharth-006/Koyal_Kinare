import { NextRequest } from 'next/server';
import { UnauthorizedError } from '@/shared/errors';

/**
 * Validates the Origin and Referer header of state-mutating requests (POST, PUT, PATCH, DELETE)
 * against allowed origins to prevent Cross-Site Request Forgery (CSRF).
 */
export function verifyMutationOrigin(req: NextRequest): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return;
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  // If neither Origin nor Referer is provided (e.g. non-browser automated test or curl),
  // we allow it provided the auth token / session header is validated by guard.
  if (!origin && !referer) {
    return;
  }

  const allowedOrigins: string[] = [];

  if (process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL.split(',').forEach((o) => {
      const trimmed = o.trim().replace(/\/$/, '');
      if (trimmed) allowedOrigins.push(trimmed);
    });
  }

  // Always allow localhost in non-production
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001');
  }

  const checkValue = origin || (referer ? new URL(referer).origin : null);

  if (checkValue) {
    const isAllowed =
      allowedOrigins.includes(checkValue) ||
      checkValue.endsWith('.onrender.com') ||
      checkValue.includes('koyal-kinare');

    if (!isAllowed) {
      throw new UnauthorizedError('Cross-origin request rejected.');
    }
  }
}
