import { query, pool } from '@/shared/database/client';
import { PoolClient } from 'pg';
import { BackupRunRecord, BackupStatus, SafeBackupFailureCode } from './backup.types';

export class BackupRepository {
  static async createRun(
    params: {
      scheduledFor: Date;
      status: BackupStatus;
      startedAt?: Date | null;
    },
    client?: PoolClient
  ): Promise<BackupRunRecord> {
    const text = `
      INSERT INTO backup_runs (scheduled_for, status, started_at)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const db = client || pool;
    const { rows } = await db.query(text, [
      params.scheduledFor.toISOString(),
      params.status,
      params.startedAt ? params.startedAt.toISOString() : null,
    ]);
    return rows[0];
  }

  static async markRunning(id: string, client?: PoolClient): Promise<void> {
    const text = `
      UPDATE backup_runs
      SET status = 'RUNNING',
          started_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `;
    const db = client || pool;
    await db.query(text, [id]);
  }

  static async markSucceeded(
    params: {
      id: string;
      backupReference: string;
      retentionUntil: Date;
    },
    client?: PoolClient
  ): Promise<void> {
    const text = `
      UPDATE backup_runs
      SET status = 'SUCCEEDED',
          completed_at = CURRENT_TIMESTAMP,
          backup_reference = $1,
          retention_until = $2
      WHERE id = $3;
    `;
    const db = client || pool;
    await db.query(text, [
      params.backupReference,
      params.retentionUntil.toISOString(),
      params.id,
    ]);
  }

  static async markFailed(
    params: {
      id: string;
      safeFailureCode: SafeBackupFailureCode;
    },
    client?: PoolClient
  ): Promise<void> {
    const text = `
      UPDATE backup_runs
      SET status = 'FAILED',
          completed_at = CURRENT_TIMESTAMP,
          safe_failure_code = $1
      WHERE id = $2;
    `;
    const db = client || pool;
    await db.query(text, [params.safeFailureCode, params.id]);
  }

  static async findById(id: string, client?: PoolClient): Promise<BackupRunRecord | null> {
    const text = 'SELECT * FROM backup_runs WHERE id = $1';
    const db = client || pool;
    const { rows } = await db.query(text, [id]);
    return rows[0] || null;
  }

  static async getLatestRun(): Promise<BackupRunRecord | null> {
    const text = `
      SELECT * FROM backup_runs
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const { rows } = await query(text);
    return rows[0] || null;
  }

  static async getLastSuccessfulRun(): Promise<BackupRunRecord | null> {
    const text = `
      SELECT * FROM backup_runs
      WHERE status = 'SUCCEEDED'
      ORDER BY completed_at DESC
      LIMIT 1;
    `;
    const { rows } = await query(text);
    return rows[0] || null;
  }

  static async findExpiredRuns(): Promise<BackupRunRecord[]> {
    const text = `
      SELECT * FROM backup_runs
      WHERE retention_until IS NOT NULL
        AND retention_until < CURRENT_TIMESTAMP;
    `;
    const { rows } = await query(text);
    return rows;
  }

  static async deleteRun(id: string, client?: PoolClient): Promise<void> {
    const text = 'DELETE FROM backup_runs WHERE id = $1;';
    const db = client || pool;
    await db.query(text, [id]);
  }
}
