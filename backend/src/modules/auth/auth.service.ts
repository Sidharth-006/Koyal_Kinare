import { AuthRepository } from './auth.repository';
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from '@/shared/auth/security';
import { createSessionCookie, createLogoutCookie } from '@/shared/auth/session';
import { UnauthorizedError, ValidationError } from '@/shared/errors';

export class AuthService {
  static async seedInitialAdminIfNeeded(): Promise<void> {
    const count = await AuthRepository.countAdmins();
    if (count === 0) {
      const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@KoyalKinare123';
      const hash = await hashPassword(defaultPassword);
      await AuthRepository.createAdmin({
        email: 'admin@koyalkinare.com',
        passwordHash: hash,
        displayName: 'Cafe Admin'
      });
    }
  }

  static async login(params: { email?: string; password?: string }): Promise<{ admin: { id: string; email: string; displayName: string }; cookieHeader: string }> {
    if (!params.email || !params.password) {
      throw new ValidationError('Email and password are required.');
    }

    await this.seedInitialAdminIfNeeded();

    const admin = await AuthRepository.findAdminByEmail(params.email);
    if (!admin) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const isValid = await verifyPassword(admin.password_hash, params.password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = new Date(Date.now() + 86400 * 7 * 1000); // 7 days

    await AuthRepository.createSession({
      adminId: admin.id,
      tokenHash,
      expiresAt
    });

    const cookieHeader = createSessionCookie(rawToken);

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.display_name
      },
      cookieHeader
    };
  }

  static async validateSessionToken(rawToken: string): Promise<{ admin: { id: string; email: string; displayName: string }; sessionId: string }> {
    if (!rawToken) {
      throw new UnauthorizedError('No authentication token provided.');
    }

    const tokenHash = hashToken(rawToken);
    const session = await AuthRepository.findValidSessionByTokenHash(tokenHash);

    if (!session) {
      throw new UnauthorizedError('Session is invalid or expired.');
    }

    await AuthRepository.updateSessionLastSeen(session.id);

    return {
      admin: {
        id: session.admin.id,
        email: session.admin.email,
        displayName: session.admin.display_name
      },
      sessionId: session.id
    };
  }

  static async logout(rawToken: string | null): Promise<string> {
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await AuthRepository.revokeSession(tokenHash);
    }
    return createLogoutCookie();
  }
}
