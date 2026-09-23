import { query, pool } from '@/shared/database/client';
import { PoolClient } from 'pg';

export interface AuditLogRecord {
  id: string;
  admin_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  request_id?: string | null;
  before_state?: any;
  after_state?: any;
  metadata?: any;
  created_at: string;
}

export class AuditRepository {
  static async create(
    params: {
      adminId?: string | null;
      action: string;
      entityType: string;
      entityId?: string | null;
      requestId?: string | null;
      beforeState?: any;
      afterState?: any;
      metadata?: any;
    },
    client?: PoolClient
  ): Promise<AuditLogRecord> {
    const text = `
      INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, request_id, before_state, after_state, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      params.adminId || null,
      params.action,
      params.entityType,
      params.entityId || null,
      params.requestId || null,
      params.beforeState ? JSON.stringify(params.beforeState) : null,
      params.afterState ? JSON.stringify(params.afterState) : null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ];

    const db = client || pool;
    const { rows } = await db.query(text, values);
    return rows[0];
  }

  static async list(params: { limit?: number; offset?: number }): Promise<AuditLogRecord[]> {
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const { rows } = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    return rows;
  }
}
