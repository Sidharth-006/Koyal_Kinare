import { query } from '@/shared/database/client';
import { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import {
  StockMovement,
  InventoryBalance,
  StockCount,
  StockMovementType,
  StockMovementListParams,
  StockMovementListResult
} from './stock.types';

export function formatStockMovement(row: any): StockMovement {
  if (!row) return row;
  return {
    id: row.id,
    inventory_item_id: row.inventory_item_id,
    inventoryItemId: row.inventory_item_id,
    business_date: typeof row.business_date === 'string' ? row.business_date : (row.business_date?.toISOString?.().slice(0, 10) || String(row.business_date)),
    businessDate: typeof row.business_date === 'string' ? row.business_date : (row.business_date?.toISOString?.().slice(0, 10) || String(row.business_date)),
    movement_type: row.movement_type,
    movementType: row.movement_type,
    quantity_delta: String(row.quantity_delta),
    quantityDelta: String(row.quantity_delta),
    unit_cost: row.unit_cost !== null && row.unit_cost !== undefined ? String(row.unit_cost) : null,
    unitCost: row.unit_cost !== null && row.unit_cost !== undefined ? String(row.unit_cost) : null,
    source_type: row.source_type,
    sourceType: row.source_type,
    source_id: row.source_id,
    sourceId: row.source_id,
    reason: row.reason || null,
    created_by: row.created_by || null,
    createdBy: row.created_by || null,
    created_at: row.created_at,
    createdAt: row.created_at
  };
}

export function formatInventoryBalance(row: any): InventoryBalance {
  if (!row) return row;
  return {
    inventory_item_id: row.inventory_item_id,
    inventoryItemId: row.inventory_item_id,
    available_quantity: String(row.available_quantity),
    availableQuantity: String(row.available_quantity),
    last_movement_at: row.last_movement_at,
    lastMovementAt: row.last_movement_at,
    updated_at: row.updated_at,
    updatedAt: row.updated_at
  };
}

export function formatStockCount(row: any): StockCount {
  if (!row) return row;
  return {
    id: row.id,
    inventory_item_id: row.inventory_item_id,
    inventoryItemId: row.inventory_item_id,
    business_date: typeof row.business_date === 'string' ? row.business_date : (row.business_date?.toISOString?.().slice(0, 10) || String(row.business_date)),
    businessDate: typeof row.business_date === 'string' ? row.business_date : (row.business_date?.toISOString?.().slice(0, 10) || String(row.business_date)),
    expected_quantity: String(row.expected_quantity),
    expectedQuantity: String(row.expected_quantity),
    actual_quantity: String(row.actual_quantity),
    actualQuantity: String(row.actual_quantity),
    variance_quantity: String(row.variance_quantity),
    varianceQuantity: String(row.variance_quantity),
    reason: row.reason || null,
    counted_by: row.counted_by,
    countedBy: row.counted_by,
    confirmed_at: row.confirmed_at,
    confirmedAt: row.confirmed_at
  };
}

export class StockRepository {
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

  static async ensureBalanceRow(inventoryItemId: string, client?: PoolClient): Promise<void> {
    const db = this.getExecutor(client);
    const sql = `
      INSERT INTO inventory_balances (inventory_item_id, available_quantity)
      VALUES ($1, 0.000)
      ON CONFLICT (inventory_item_id) DO NOTHING;
    `;
    await db.query(sql, [inventoryItemId]);
  }

  static async lockAndGetBalance(inventoryItemId: string, client: PoolClient): Promise<Decimal> {
    await this.ensureBalanceRow(inventoryItemId, client);
    const sql = `
      SELECT available_quantity 
      FROM inventory_balances 
      WHERE inventory_item_id = $1 
      FOR UPDATE;
    `;
    const { rows } = await client.query(sql, [inventoryItemId]);
    if (!rows[0]) {
      return new Decimal(0);
    }
    return new Decimal(rows[0].available_quantity);
  }

  static async updateBalance(inventoryItemId: string, newBalance: Decimal, client: PoolClient): Promise<string> {
    const sql = `
      UPDATE inventory_balances
      SET available_quantity = $1,
          last_movement_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE inventory_item_id = $2
      RETURNING available_quantity;
    `;
    const { rows } = await client.query(sql, [newBalance.toFixed(3), inventoryItemId]);
    return String(rows[0].available_quantity);
  }

  static async insertMovement(
    params: {
      inventoryItemId: string;
      businessDate: string;
      movementType: StockMovementType;
      quantityDelta: string;
      unitCost?: string | null;
      sourceType: string;
      sourceId: string;
      reason?: string | null;
      createdBy?: string | null;
    },
    client: PoolClient
  ): Promise<StockMovement> {
    const sql = `
      INSERT INTO stock_movements (
        inventory_item_id,
        business_date,
        movement_type,
        quantity_delta,
        unit_cost,
        source_type,
        source_id,
        reason,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      params.inventoryItemId,
      params.businessDate,
      params.movementType,
      params.quantityDelta,
      params.unitCost || null,
      params.sourceType,
      params.sourceId,
      params.reason || null,
      params.createdBy || null
    ];
    const { rows } = await client.query(sql, values);
    return formatStockMovement(rows[0]);
  }

  static async insertStockCount(
    params: {
      inventoryItemId: string;
      businessDate: string;
      expectedQuantity: string;
      actualQuantity: string;
      varianceQuantity: string;
      reason?: string | null;
      countedBy: string;
    },
    client: PoolClient
  ): Promise<StockCount> {
    const sql = `
      INSERT INTO stock_counts (
        inventory_item_id,
        business_date,
        expected_quantity,
        actual_quantity,
        variance_quantity,
        reason,
        counted_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      params.inventoryItemId,
      params.businessDate,
      params.expectedQuantity,
      params.actualQuantity,
      params.varianceQuantity,
      params.reason || null,
      params.countedBy
    ];
    const { rows } = await client.query(sql, values);
    return formatStockCount(rows[0]);
  }

  static async getBalance(inventoryItemId: string, client?: PoolClient): Promise<InventoryBalance | null> {
    const db = this.getExecutor(client);
    await this.ensureBalanceRow(inventoryItemId, client);
    const sql = `SELECT * FROM inventory_balances WHERE inventory_item_id = $1;`;
    const { rows } = await db.query(sql, [inventoryItemId]);
    return rows[0] ? formatInventoryBalance(rows[0]) : null;
  }

  static async hasOpeningStock(
    inventoryItemId: string,
    businessDate: string,
    sourceId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const db = this.getExecutor(client);
    const sql = `
      SELECT 1 FROM stock_movements 
      WHERE inventory_item_id = $1 
        AND business_date = $2 
        AND source_id = $3 
        AND movement_type = 'OPENING' 
      LIMIT 1;
    `;
    const { rows } = await db.query(sql, [inventoryItemId, businessDate, sourceId]);
    return rows.length > 0;
  }

  static async hasMachineMovement(sourceType: string, sourceId: string, client?: PoolClient): Promise<boolean> {
    const db = this.getExecutor(client);
    const sql = `
      SELECT 1 FROM stock_movements 
      WHERE source_type = $1 AND source_id = $2 
      LIMIT 1;
    `;
    const { rows } = await db.query(sql, [sourceType, sourceId]);
    return rows.length > 0;
  }

  static async getSumOfDeltas(inventoryItemId: string, client?: PoolClient): Promise<string> {
    const db = this.getExecutor(client);
    const sql = `
      SELECT COALESCE(SUM(quantity_delta), 0.000)::text as sum_deltas 
      FROM stock_movements 
      WHERE inventory_item_id = $1;
    `;
    const { rows } = await db.query(sql, [inventoryItemId]);
    return String(rows[0]?.sum_deltas || '0.000');
  }

  static async listMovements(params: StockMovementListParams): Promise<StockMovementListResult> {
    const page = Math.max(1, parseInt(String(params.page || 1), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(params.pageSize || 20), 10)));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.itemId) {
      conditions.push(`inventory_item_id = $${paramIndex}`);
      values.push(params.itemId);
      paramIndex++;
    }

    if (params.from) {
      conditions.push(`business_date >= $${paramIndex}`);
      values.push(params.from);
      paramIndex++;
    }

    if (params.to) {
      conditions.push(`business_date <= $${paramIndex}`);
      values.push(params.to);
      paramIndex++;
    }

    if (params.type) {
      conditions.push(`movement_type = $${paramIndex}`);
      values.push(params.type);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*)::int as total FROM stock_movements ${whereClause};`;
    const countRes = await query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const dataSql = `
      SELECT * FROM stock_movements
      ${whereClause}
      ORDER BY business_date DESC, created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    const dataValues = [...values, pageSize, offset];
    const dataRes = await query(dataSql, dataValues);

    const items = dataRes.rows.map(formatStockMovement);
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
