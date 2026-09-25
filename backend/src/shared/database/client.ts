import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/koyal_kinare';

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  // Prevent unhandled errors when idle clients are disconnected by Neon serverless pooler
  console.warn('[DB Pool] Idle client disconnect/error:', err?.message || err);
});

function isTransientConnectionError(err: any): boolean {
  const msg = err?.message || '';
  const code = err?.code || '';
  return (
    msg.includes('Connection terminated') ||
    msg.includes('timeout exceeded') ||
    msg.includes('connection timeout') ||
    code === 'ECONNRESET' ||
    code === '57P01' || // admin_shutdown
    code === '57P03'    // cannot_connect_now
  );
}

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    return { rows: res.rows, rowCount: res.rowCount };
  } catch (err: any) {
    if (isTransientConnectionError(err)) {
      console.warn('[DB Pool] Retrying query after connection reset...');
      const start = Date.now();
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      return { rows: res.rows, rowCount: res.rowCount };
    }
    throw err;
  }
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (err: any) {
    if (isTransientConnectionError(err)) {
      console.warn('[DB Pool] Retrying client connect after connection reset...');
      client = await pool.connect();
    } else {
      throw err;
    }
  }

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failure if connection is lost
    }
    throw error;
  } finally {
    client.release();
  }
}
