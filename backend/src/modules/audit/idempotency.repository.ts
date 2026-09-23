import { query } from '@/shared/database/client';
import crypto from 'crypto';
import { PoolClient } from 'pg';

export interface IdempotencyRecord {
  id: string;
  key: string;
  request_hash: string;
  response_code: number;
  response_body: any;
  created_at: string;
  expires_at: string;
}

export class IdempotencyRepository {
  static computeHash(payload: any): string {
    const str = JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  static async find(key: string): Promise<IdempotencyRecord | null> {
    const { rows } = await query('SELECT * FROM idempotency WHERE key = $1 AND expires_at > CURRENT_TIMESTAMP', [key]);
    return rows[0] || null;
  }

  static async save(
    key: string,
    requestHash: string,
    responseCode: number,
    responseBody: any,
    client?: PoolClient,
    ttlHours: number = 24
  ): Promise<IdempotencyRecord> {
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
    const text = `
      INSERT INTO idempotency (key, request_hash, response_code, response_body, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [key, requestHash, responseCode, JSON.stringify(responseBody), expiresAt];
    const db = client || { query: (t: string, v: any[]) => query(t, v) };
    const { rows } = await db.query(text, values);
    return rows[0];
  }
}
