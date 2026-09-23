import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from '@/shared/auth/security';
import { createSessionCookie, createLogoutCookie } from '@/shared/auth/session';

describe('Auth & Session Security Unit & Security Tests', () => {
  it('should hash and verify passwords securely with Argon2', async () => {
    const plain = 'SecretPassword123!';
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);

    const isValid = await verifyPassword(hash, plain);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword(hash, 'WrongPassword');
    expect(isInvalid).toBe(false);
  });

  it('should generate secure raw token and token hash', () => {
    const { rawToken, tokenHash } = generateSessionToken();
    expect(rawToken).toBeDefined();
    expect(rawToken.length).toBe(64);
    expect(hashToken(rawToken)).toBe(tokenHash);
  });

  it('should format HTTP-only secure cookie with Lax sameSite', () => {
    const rawToken = 'abc123tokenhashxyz';
    const cookie = createSessionCookie(rawToken);

    expect(cookie).toContain('koyal_session=abc123tokenhashxyz');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('should format logout cookie with Max-Age=0', () => {
    const logoutCookie = createLogoutCookie();
    expect(logoutCookie).toContain('koyal_session=;');
    expect(logoutCookie).toContain('Max-Age=0');
  });
});
