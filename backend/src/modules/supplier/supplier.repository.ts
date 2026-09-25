import { query } from '@/shared/database/client';
import { PoolClient } from 'pg';
import { Supplier, SupplierListParams, SupplierListResult } from './supplier.types';

export function formatSupplier(row: any): Supplier {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    contact_person: row.contact_person || null,
    contactPerson: row.contact_person || null,
    phone: row.phone || null,
    email: row.email || null,
    address: row.address || null,
    gstin: row.gstin || null,
    notes: row.notes || null,
    is_archived: row.is_archived,
    isArchived: row.is_archived,
    created_by: row.created_by || null,
    createdBy: row.created_by || null,
    updated_by: row.updated_by || null,
    updatedBy: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SupplierRepository {
  private static getExecutor(client?: PoolClient) {
    if (client) {
      return {
        query: (text: string, params?: any[]) => client.query(text, params)
      };
    }
    return {
      query: (text: string, params?: any[]) => query(text, params)
    };
  }

  static async findById(id: string, client?: PoolClient): Promise<Supplier | null> {
    const db = this.getExecutor(client);
    const { rows } = await db.query(`SELECT * FROM suppliers WHERE id = $1`, [id]);
    return rows[0] ? formatSupplier(rows[0]) : null;
  }

  static async findActiveByName(name: string, excludeId?: string, client?: PoolClient): Promise<Supplier | null> {
    const db = this.getExecutor(client);
    let sql = `SELECT * FROM suppliers WHERE LOWER(name) = LOWER($1) AND is_archived = FALSE`;
    const params: any[] = [name];

    if (excludeId) {
      sql += ` AND id != $2`;
      params.push(excludeId);
    }

    const { rows } = await db.query(sql, params);
    return rows[0] ? formatSupplier(rows[0]) : null;
  }

  static async create(
    data: {
      name: string;
      contactPerson?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      gstin?: string | null;
      notes?: string | null;
    },
    adminId: string,
    client?: PoolClient
  ): Promise<Supplier> {
    const db = this.getExecutor(client);
    const text = `
      INSERT INTO suppliers (name, contact_person, phone, email, address, gstin, notes, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING *;
    `;
    const values = [
      data.name,
      data.contactPerson || null,
      data.phone || null,
      data.email || null,
      data.address || null,
      data.gstin || null,
      data.notes || null,
      adminId
    ];

    const { rows } = await db.query(text, values);
    return formatSupplier(rows[0]);
  }

  static async update(
    id: string,
    data: {
      name?: string;
      contactPerson?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      gstin?: string | null;
      notes?: string | null;
    },
    adminId: string,
    client?: PoolClient
  ): Promise<Supplier> {
    const db = this.getExecutor(client);
    const existing = await this.findById(id, client);
    if (!existing) {
      throw new Error('Supplier not found');
    }

    const name = data.name !== undefined ? data.name : existing.name;
    const contactPerson = data.contactPerson !== undefined ? data.contactPerson : existing.contact_person;
    const phone = data.phone !== undefined ? data.phone : existing.phone;
    const email = data.email !== undefined ? data.email : existing.email;
    const address = data.address !== undefined ? data.address : existing.address;
    const gstin = data.gstin !== undefined ? data.gstin : existing.gstin;
    const notes = data.notes !== undefined ? data.notes : existing.notes;

    const text = `
      UPDATE suppliers
      SET name = $1,
          contact_person = $2,
          phone = $3,
          email = $4,
          address = $5,
          gstin = $6,
          notes = $7,
          updated_by = $8,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *;
    `;
    const values = [name, contactPerson, phone, email, address, gstin, notes, adminId, id];
    const { rows } = await db.query(text, values);
    return formatSupplier(rows[0]);
  }

  static async setArchiveStatus(id: string, isArchived: boolean, adminId: string, client?: PoolClient): Promise<Supplier> {
    const db = this.getExecutor(client);
    const text = `
      UPDATE suppliers
      SET is_archived = $1,
          updated_by = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const { rows } = await db.query(text, [isArchived, adminId, id]);
    return formatSupplier(rows[0]);
  }

  static async list(params: SupplierListParams): Promise<SupplierListResult> {
    const page = Math.max(1, parseInt(String(params.page || 1), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(params.pageSize || 20), 10)));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.search && params.search.trim().length > 0) {
      const searchTerm = `%${params.search.trim()}%`;
      conditions.push(`(name ILIKE $${paramIndex} OR contact_person ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      values.push(searchTerm);
      paramIndex++;
    }

    const status = params.status || 'active';
    if (status === 'active') {
      conditions.push(`is_archived = FALSE`);
    } else if (status === 'archived') {
      conditions.push(`is_archived = TRUE`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*)::int as total FROM suppliers ${whereClause}`;
    const countRes = await query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const dataSql = `
      SELECT * FROM suppliers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataValues = [...values, pageSize, offset];
    const dataRes = await query(dataSql, dataValues);

    const items = dataRes.rows.map(formatSupplier);
    const totalPages = Math.ceil(total / pageSize) || (total === 0 ? 0 : 1);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    };
  }
}
