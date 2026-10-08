import { query, pool } from '@/shared/database/client';
import { PoolClient } from 'pg';
import crypto from 'crypto';

export interface IdempotencyKeyRecord {
  id: string;
  admin_id: string;
  route: string;
  key: string;
  request_hash: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  response_reference: any;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export class IdempotencyKeysRepository {
  /**
   * Deterministically computes SHA-256 hash of payload.
   * Sorts object keys recursively to guarantee deterministic hashing.
   */
  static computeHash(payload: any): string {
    const normalize = (obj: any): any => {
      if (obj === null || obj === undefined) return null;
      if (typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(normalize);
      const sortedKeys = Object.keys(obj).sort();
      const result: Record<string, any> = {};
      for (const k of sortedKeys) {
        result[k] = normalize(obj[k]);
      }
      return result;
    };

    const serialized = JSON.stringify(normalize(payload || {}));
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  static async findByKey(
    adminId: string,
    route: string,
    key: string,
    client?: PoolClient
  ): Promise<IdempotencyKeyRecord | null> {
    const text = `
      SELECT * FROM idempotency_keys
      WHERE admin_id = $1 AND route = $2 AND key = $3
      FOR UPDATE;
    `;
    const db = client || pool;
    const { rows } = await db.query(text, [adminId, route, key]);
    return rows[0] || null;
  }

  static async createInProgress(
    params: {
      adminId: string;
      route: string;
      key: string;
      requestHash: string;
      expiresAt: Date;
    },
    client?: PoolClient
  ): Promise<IdempotencyKeyRecord> {
    const text = `
      INSERT INTO idempotency_keys (admin_id, route, key, request_hash, status, expires_at)
      VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5)
      RETURNING *;
    `;
    const db = client || pool;
    const { rows } = await db.query(text, [
      params.adminId,
      params.route,
      params.key,
      params.requestHash,
      params.expiresAt.toISOString(),
    ]);
    return rows[0];
  }

  static async markCompleted(
    id: string,
    responseReference: any,
    client?: PoolClient
  ): Promise<void> {
    const text = `
      UPDATE idempotency_keys
      SET status = 'COMPLETED',
          response_reference = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `;
    const db = client || pool;
    await db.query(text, [JSON.stringify(responseReference), id]);
  }

  static async markFailed(id: string, client?: PoolClient): Promise<void> {
    const text = `
      UPDATE idempotency_keys
      SET status = 'FAILED',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `;
    const db = client || pool;
    await db.query(text, [id]);
  }

  static async deleteById(id: string, client?: PoolClient): Promise<void> {
    const text = 'DELETE FROM idempotency_keys WHERE id = $1;';
    const db = client || pool;
    await db.query(text, [id]);
  }

  static async cleanExpired(client?: PoolClient): Promise<number> {
    const text = 'DELETE FROM idempotency_keys WHERE expires_at < CURRENT_TIMESTAMP;';
    const db = client || pool;
    const res = await db.query(text);
    return res.rowCount || 0;
  }
}
