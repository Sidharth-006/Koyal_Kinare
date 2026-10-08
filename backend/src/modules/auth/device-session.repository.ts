import { query, pool } from '@/shared/database/client';
import { PoolClient } from 'pg';

export interface DeviceSessionRecord {
  id: string;
  session_id: string;
  admin_id: string;
  device_label: string;
  user_agent_hash: string;
  last_ip_hash?: string | null;
  last_seen_at: string;
  revoked_at?: string | null;
  created_at: string;
}

export class DeviceSessionRepository {
  static async create(
    params: {
      sessionId: string;
      adminId: string;
      deviceLabel: string;
      userAgentHash: string;
      lastIpHash?: string | null;
    },
    client?: PoolClient
  ): Promise<DeviceSessionRecord> {
    const text = `
      INSERT INTO device_sessions (session_id, admin_id, device_label, user_agent_hash, last_ip_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [
      params.sessionId,
      params.adminId,
      params.deviceLabel,
      params.userAgentHash,
      params.lastIpHash || null
    ];
    const db = client || pool;
    const { rows } = await db.query(text, values);
    return rows[0];
  }

  static async findById(id: string, client?: PoolClient): Promise<DeviceSessionRecord | null> {
    const text = 'SELECT * FROM device_sessions WHERE id = $1';
    const db = client || pool;
    const { rows } = await db.query(text, [id]);
    return rows[0] || null;
  }

  static async findBySessionId(sessionId: string, client?: PoolClient): Promise<DeviceSessionRecord | null> {
    const text = 'SELECT * FROM device_sessions WHERE session_id = $1';
    const db = client || pool;
    const { rows } = await db.query(text, [sessionId]);
    return rows[0] || null;
  }

  static async listActiveByAdminId(adminId: string): Promise<DeviceSessionRecord[]> {
    const text = `
      SELECT ds.*
      FROM device_sessions ds
      JOIN sessions s ON ds.session_id = s.id
      WHERE ds.admin_id = $1
        AND ds.revoked_at IS NULL
        AND s.revoked_at IS NULL
        AND s.expires_at > CURRENT_TIMESTAMP
      ORDER BY ds.last_seen_at DESC;
    `;
    const { rows } = await query(text, [adminId]);
    return rows;
  }

  static async updateLastSeen(sessionId: string, client?: PoolClient): Promise<void> {
    const text = `
      UPDATE device_sessions
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE session_id = $1;
    `;
    const db = client || pool;
    await db.query(text, [sessionId]);
  }

  static async revokeById(
    id: string,
    adminId: string,
    client?: PoolClient
  ): Promise<DeviceSessionRecord | null> {
    const text = `
      UPDATE device_sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND admin_id = $2 AND revoked_at IS NULL
      RETURNING *;
    `;
    const db = client || pool;
    const { rows } = await db.query(text, [id, adminId]);
    return rows[0] || null;
  }

  static async revokeBySessionId(
    sessionId: string,
    client?: PoolClient
  ): Promise<void> {
    const text = `
      UPDATE device_sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE session_id = $1 AND revoked_at IS NULL;
    `;
    const db = client || pool;
    await db.query(text, [sessionId]);
  }

  static async revokeAllOthers(
    adminId: string,
    currentSessionId: string,
    client?: PoolClient
  ): Promise<number> {
    const text = `
      UPDATE device_sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE admin_id = $1
        AND session_id != $2
        AND revoked_at IS NULL;
    `;
    const db = client || pool;
    const res = await db.query(text, [adminId, currentSessionId]);
    return res.rowCount || 0;
  }
}
