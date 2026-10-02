import { serialize, parse } from 'cookie';

const COOKIE_NAME = process.env.COOKIE_NAME || 'koyal_session';
const IS_PROD = process.env.NODE_ENV === 'production';

export function createSessionCookie(rawToken: string, maxAgeSeconds: number = 86400 * 7): string {
  return serialize(COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeSeconds
  });
}

export function createLogoutCookie(): string {
  return serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
    maxAge: 0
  });
}

export function extractRawTokenFromHeader(cookieHeader: string | null, authHeader?: string | null): string | null {
  // 1. Check Authorization: Bearer <token>
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  // 2. Check Cookie header
  if (cookieHeader) {
    const cookies = parse(cookieHeader);
    if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
  }

  return null;
}

