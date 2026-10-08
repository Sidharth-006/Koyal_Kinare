import { query, pool } from '@/shared/database/client';
import { PoolClient } from 'pg';

export interface DomainRevisionRecord {
  domain_key: string;
  revision: string; // BIGINT is returned as string by pg
  updated_at: string;
}

export class RevisionRepository {
  static async getRevision(
    domainKey: string,
    client?: PoolClient
  ): Promise<{ domainKey: string; revision: number; updatedAt: string } | null> {
    const text = 'SELECT domain_key, revision, updated_at FROM data_change_revisions WHERE domain_key = $1';
    const db = client || pool;
    const { rows } = await db.query(text, [domainKey]);
    if (!rows[0]) return null;
    return {
      domainKey: rows[0].domain_key,
      revision: parseInt(rows[0].revision, 10),
      updatedAt: rows[0].updated_at,
    };
  }

  static async getAllRevisions(
    client?: PoolClient
  ): Promise<Array<{ domainKey: string; revision: number; updatedAt: string }>> {
    const text = 'SELECT domain_key, revision, updated_at FROM data_change_revisions ORDER BY domain_key ASC';
    const db = client || pool;
    const { rows } = await db.query(text);
    return rows.map((r: any) => ({
      domainKey: r.domain_key,
      revision: parseInt(r.revision, 10),
      updatedAt: r.updated_at,
    }));
  }

  static async bumpRevision(domainKey: string, client?: PoolClient): Promise<number> {
    const text = `
      INSERT INTO data_change_revisions (domain_key, revision, updated_at)
      VALUES ($1, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (domain_key)
      DO UPDATE SET revision = data_change_revisions.revision + 1, updated_at = CURRENT_TIMESTAMP
      RETURNING revision;
    `;
    const db = client || pool;
    const { rows } = await db.query(text, [domainKey]);
    return parseInt(rows[0].revision, 10);
  }
}
