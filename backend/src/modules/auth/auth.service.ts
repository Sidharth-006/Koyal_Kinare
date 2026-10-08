import { AuthRepository } from './auth.repository';
import { DeviceSessionRepository } from './device-session.repository';
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from '@/shared/auth/security';
import { createSessionCookie, createLogoutCookie } from '@/shared/auth/session';
import { parseDeviceLabel, hashUserAgent, hashIp } from '@/shared/auth/device-label';
import { AuditService } from '@/modules/audit/audit.service';
import { logger } from '@/shared/logging/logger';
import { UnauthorizedError, ValidationError } from '@/shared/errors';

export class AuthService {
  private static isAdminSeeded = false;

  static async seedInitialAdminIfNeeded(): Promise<void> {
    if (this.isAdminSeeded) return;

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
    this.isAdminSeeded = true;
  }

  static async login(
    params: { email?: string; password?: string },
    clientMetadata?: { userAgent?: string; ip?: string; requestId?: string }
  ): Promise<{ admin: { id: string; email: string; displayName: string }; token: string; cookieHeader: string; sessionId: string }> {
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

    const session = await AuthRepository.createSession({
      adminId: admin.id,
      tokenHash,
      expiresAt
    });

    const deviceLabel = parseDeviceLabel(clientMetadata?.userAgent);
    const userAgentHash = hashUserAgent(clientMetadata?.userAgent);
    const lastIpHash = hashIp(clientMetadata?.ip);

    // Register device session record
    const deviceSession = await DeviceSessionRepository.create({
      sessionId: session.id,
      adminId: admin.id,
      deviceLabel,
      userAgentHash,
      lastIpHash
    });

    // Audit session creation
    await AuditService.logEvent({
      adminId: admin.id,
      action: 'SESSION_CREATED',
      entityType: 'SESSION',
      entityId: deviceSession.id,
      requestId: clientMetadata?.requestId,
      metadata: {
        deviceLabel,
      }
    });

    logger.info(
      {
        requestId: clientMetadata?.requestId,
        action: 'SESSION_CREATED',
        adminId: admin.id,
        deviceSessionId: deviceSession.id,
        deviceLabel
      },
      'Admin logged in and device session created'
    );

    const cookieHeader = createSessionCookie(rawToken);

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.display_name
      },
      token: rawToken,
      cookieHeader,
      sessionId: session.id
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

    // Throttled last_seen_at updates (at most once every 60 seconds)
    const lastSeenTime = new Date(session.last_seen_at).getTime();
    if (Date.now() - lastSeenTime > 60000) {
      await Promise.all([
        AuthRepository.updateSessionLastSeen(session.id),
        DeviceSessionRepository.updateLastSeen(session.id)
      ]);
    }

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
      const session = await AuthRepository.findValidSessionByTokenHash(tokenHash);
      if (session) {
        await DeviceSessionRepository.revokeBySessionId(session.id);
      }
      await AuthRepository.revokeSession(tokenHash);
    }
    return createLogoutCookie();
  }
}
