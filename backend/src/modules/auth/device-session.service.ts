import { DeviceSessionRepository, DeviceSessionRecord } from './device-session.repository';
import { withTransaction } from '@/shared/database/client';
import { AuditService } from '@/modules/audit/audit.service';
import { logger } from '@/shared/logging/logger';
import { NotFoundError } from '@/shared/errors';

export interface SafeDeviceSessionDto {
  id: string;
  deviceLabel: string;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export class DeviceSessionService {
  /**
   * Lists all active device sessions for the authenticated admin.
   * Strips all internal tokens, hashes, and raw technical headers.
   */
  static async listSessions(adminId: string, currentSessionId: string): Promise<SafeDeviceSessionDto[]> {
    const records = await DeviceSessionRepository.listActiveByAdminId(adminId);

    return records.map((record) => ({
      id: record.id,
      deviceLabel: record.device_label,
      lastSeenAt: record.last_seen_at,
      createdAt: record.created_at,
      isCurrent: record.session_id === currentSessionId,
    }));
  }

  /**
   * Revokes a specific device session for the admin.
   * If the revoked session is the current caller's session, returns isCurrentSession: true.
   */
  static async revokeSession(
    id: string,
    adminId: string,
    currentSessionId: string,
    requestId?: string
  ): Promise<{ success: boolean; isCurrentSession: boolean }> {
    const existing = await DeviceSessionRepository.findById(id);

    if (!existing || existing.admin_id !== adminId || existing.revoked_at) {
      throw new NotFoundError('Session not found or already revoked.');
    }

    const isCurrentSession = existing.session_id === currentSessionId;

    await withTransaction(async (client) => {
      // 1. Mark device_session as revoked
      await DeviceSessionRepository.revokeById(id, adminId, client);

      // 2. Mark primary sessions table as revoked
      await client.query(
        'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL',
        [existing.session_id]
      );

      // 3. Emit audit event
      await AuditService.logEvent(
        {
          adminId,
          action: 'SESSION_REVOKED',
          entityType: 'SESSION',
          entityId: id,
          requestId,
          metadata: {
            deviceLabel: existing.device_label,
            isCurrentSession,
          },
        },
        client
      );
    });

    logger.info(
      {
        requestId,
        action: 'SESSION_REVOKED',
        adminId,
        deviceSessionId: id,
        isCurrentSession,
      },
      'Admin session successfully revoked'
    );

    return { success: true, isCurrentSession };
  }

  /**
   * Revokes all other active sessions for the current admin, preserving the caller session.
   */
  static async revokeOtherSessions(
    adminId: string,
    currentSessionId: string,
    requestId?: string
  ): Promise<{ revokedCount: number }> {
    let count = 0;

    await withTransaction(async (client) => {
      // 1. Revoke all other device sessions
      count = await DeviceSessionRepository.revokeAllOthers(adminId, currentSessionId, client);

      // 2. Revoke all other primary sessions
      await client.query(
        'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_id = $1 AND id != $2 AND revoked_at IS NULL',
        [adminId, currentSessionId]
      );

      // 3. Emit audit log
      await AuditService.logEvent(
        {
          adminId,
          action: 'REVOKE_OTHER_SESSIONS',
          entityType: 'SESSION',
          requestId,
          metadata: {
            revokedCount: count,
          },
        },
        client
      );
    });

    logger.info(
      {
        requestId,
        action: 'REVOKE_OTHER_SESSIONS',
        adminId,
        revokedCount: count,
      },
      'All other admin sessions successfully revoked'
    );

    return { revokedCount: count };
  }
}
