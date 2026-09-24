import { query } from '@/shared/database/client';
import { PoolClient } from 'pg';
import { InventoryItem, InventoryListParams, InventoryListResult } from './inventory.types';

export function formatInventoryItem(row: any): InventoryItem {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    item_type: row.item_type,
    itemType: row.item_type,
    base_unit: row.base_unit,
    baseUnit: row.base_unit,
    minimum_stock: String(row.minimum_stock),
    minimumStock: String(row.minimum_stock),
    description: row.description || null,
    is_archived: row.is_archived,
    isArchived: row.is_archived,
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class InventoryRepository {
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

  static async findById(id: string, client?: PoolClient): Promise<InventoryItem | null> {
    const db = this.getExecutor(client);
    const { rows } = await db.query(`SELECT * FROM inventory_items WHERE id = $1`, [id]);
    return rows[0] ? formatInventoryItem(rows[0]) : null;
  }

  static async findActiveByName(name: string, excludeId?: string, client?: PoolClient): Promise<InventoryItem | null> {
    const db = this.getExecutor(client);
    const normalized = name.trim().toLowerCase();
    let sql = `SELECT * FROM inventory_items WHERE LOWER(name) = $1 AND is_archived = FALSE`;
    const params: any[] = [normalized];

    if (excludeId) {
      sql += ` AND id != $2`;
      params.push(excludeId);
    }

    const { rows } = await db.query(sql, params);
    return rows[0] ? formatInventoryItem(rows[0]) : null;
  }

  static async create(
    data: {
      name: string;
      itemType: string;
      baseUnit: string;
      minimumStock: string;
      description?: string | null;
    },
    adminId: string,
    client?: PoolClient
  ): Promise<InventoryItem> {
    const db = this.getExecutor(client);
    const text = `
      INSERT INTO inventory_items (name, item_type, base_unit, minimum_stock, description, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $6)
      RETURNING *;
    `;
    const values = [
      data.name.trim(),
      data.itemType,
      data.baseUnit,
      data.minimumStock,
      data.description?.trim() || null,
      adminId
    ];

    const { rows } = await db.query(text, values);
    return formatInventoryItem(rows[0]);
  }

  static async update(
    id: string,
    data: {
      name?: string;
      itemType?: string;
      baseUnit?: string;
      minimumStock?: string;
      description?: string | null;
    },
    adminId: string,
    client?: PoolClient
  ): Promise<InventoryItem> {
    const db = this.getExecutor(client);
    const existing = await this.findById(id, client);
    if (!existing) {
      throw new Error('Item not found');
    }

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const itemType = data.itemType !== undefined ? data.itemType : existing.item_type;
    const baseUnit = data.baseUnit !== undefined ? data.baseUnit : existing.base_unit;
    const minimumStock = data.minimumStock !== undefined ? data.minimumStock : existing.minimum_stock;
    const description = data.description !== undefined ? (data.description ? data.description.trim() : null) : existing.description;

    const text = `
      UPDATE inventory_items
      SET name = $1,
          item_type = $2,
          base_unit = $3,
          minimum_stock = $4,
          description = $5,
          updated_by = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *;
    `;
    const values = [name, itemType, baseUnit, minimumStock, description, adminId, id];
    const { rows } = await db.query(text, values);
    return formatInventoryItem(rows[0]);
  }

  static async setArchiveStatus(id: string, isArchived: boolean, adminId: string, client?: PoolClient): Promise<InventoryItem> {
    const db = this.getExecutor(client);
    const text = `
      UPDATE inventory_items
      SET is_archived = $1,
          updated_by = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const { rows } = await db.query(text, [isArchived, adminId, id]);
    return formatInventoryItem(rows[0]);
  }

  static async list(params: InventoryListParams): Promise<InventoryListResult> {
    const page = Math.max(1, parseInt(String(params.page || 1), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(params.pageSize || 20), 10)));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.search && params.search.trim().length > 0) {
      conditions.push(`name ILIKE $${paramIndex}`);
      values.push(`%${params.search.trim()}%`);
      paramIndex++;
    }

    if (params.type && params.type.trim().length > 0) {
      conditions.push(`item_type = $${paramIndex}`);
      values.push(params.type.trim());
      paramIndex++;
    }

    const status = params.status || 'active';
    if (status === 'active') {
      conditions.push(`is_archived = FALSE`);
    } else if (status === 'archived') {
      conditions.push(`is_archived = TRUE`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*)::int as total FROM inventory_items ${whereClause}`;
    const countRes = await query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const dataSql = `
      SELECT * FROM inventory_items
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataValues = [...values, pageSize, offset];
    const dataRes = await query(dataSql, dataValues);

    const items = dataRes.rows.map(formatInventoryItem);
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      items,
      total,
      page,
      pageSize,
      totalPages
    };
  }

  static async hasStockHistory(itemId: string, client?: PoolClient): Promise<boolean> {
    const db = this.getExecutor(client);
    try {
      const { rows } = await db.query(
        `SELECT 1 FROM stock_movements WHERE inventory_item_id = $1 LIMIT 1`,
        [itemId]
      );
      return rows.length > 0;
    } catch (err: any) {
      if (err.code === '42P01') { // PostgreSQL error 42P01: undefined_table
        return false;
      }
      throw err;
    }
  }

  static async hasPendingFlows(itemId: string, client?: PoolClient): Promise<boolean> {
    const db = this.getExecutor(client);
    try {
      const { rows } = await db.query(
        `SELECT 1 FROM purchase_lines pl
         JOIN purchases p ON pl.purchase_id = p.id
         WHERE pl.inventory_item_id = $1 AND p.status = 'DRAFT'
         LIMIT 1`,
        [itemId]
      );
      return rows.length > 0;
    } catch (err: any) {
      if (err.code === '42P01') { // PostgreSQL error 42P01: undefined_table
        return false;
      }
      throw err;
    }
  }
}
