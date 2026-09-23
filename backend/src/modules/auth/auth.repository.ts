import { query } from '@/shared/database/client';

export interface AdminRecord {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string;
  admin_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at?: string | null;
  created_at: string;
  last_seen_at: string;
}

export class AuthRepository {
  static async findAdminByEmail(email: string): Promise<AdminRecord | null> {
    const { rows } = await query('SELECT * FROM admins WHERE email = $1 AND is_active = TRUE', [email.toLowerCase().trim()]);
    return rows[0] || null;
  }

  static async findAdminById(id: string): Promise<AdminRecord | null> {
    const { rows } = await query('SELECT * FROM admins WHERE id = $1 AND is_active = TRUE', [id]);
    return rows[0] || null;
  }

  static async createAdmin(params: { email: string; passwordHash: string; displayName: string }): Promise<AdminRecord> {
    const text = `
      INSERT INTO admins (email, password_hash, display_name)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await query(text, [params.email.toLowerCase().trim(), params.passwordHash, params.displayName]);
    return rows[0];
  }

  static async countAdmins(): Promise<number> {
    const { rows } = await query('SELECT COUNT(*) as count FROM admins');
    return parseInt(rows[0].count, 10);
  }

  static async createSession(params: { adminId: string; tokenHash: string; expiresAt: Date }): Promise<SessionRecord> {
    const text = `
      INSERT INTO sessions (admin_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await query(text, [params.adminId, params.tokenHash, params.expiresAt.toISOString()]);
    return rows[0];
  }

  static async findValidSessionByTokenHash(tokenHash: string): Promise<(SessionRecord & { admin: AdminRecord }) | null> {
    const text = `
      SELECT s.*, a.id as admin_id_val, a.email, a.display_name, a.is_active
      FROM sessions s
      JOIN admins a ON s.admin_id = a.id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > CURRENT_TIMESTAMP
        AND a.is_active = TRUE;
    `;
    const { rows } = await query(text, [tokenHash]);
    if (!rows[0]) return null;

    const row = rows[0];
    return {
      id: row.id,
      admin_id: row.admin_id,
      token_hash: row.token_hash,
      expires_at: row.expires_at,
      revoked_at: row.revoked_at,
      created_at: row.created_at,
      last_seen_at: row.last_seen_at,
      admin: {
        id: row.admin_id_val,
        email: row.email,
        password_hash: '',
        display_name: row.display_name,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at
      }
    };
  }

  static async updateSessionLastSeen(sessionId: string): Promise<void> {
    await query('UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [sessionId]);
  }

  static async revokeSession(tokenHash: string): Promise<void> {
    await query('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1', [tokenHash]);
  }
}
