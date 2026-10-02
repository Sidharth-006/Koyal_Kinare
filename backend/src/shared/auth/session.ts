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

export function extractRawTokenFromHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  return cookies[COOKIE_NAME] || null;
}

