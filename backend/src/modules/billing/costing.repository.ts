import { query } from '@/shared/database/client';
import { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { InventoryCostState, BillConsumption, BillCostCoverage } from './costing.types';

export class CostingRepository {
  private static getExecutor(client?: PoolClient) {
    return client || { query: (t: string, v?: any[]) => query(t, v) };
  }

  static async ensureCostStateRow(inventoryItemId: string, client?: PoolClient): Promise<void> {
    const db = this.getExecutor(client);
    const sql = `
      INSERT INTO inventory_cost_state (inventory_item_id, average_unit_cost, quantity_on_cost_basis)
      VALUES ($1, 0.0000, 0.000)
      ON CONFLICT (inventory_item_id) DO NOTHING;
    `;
    await db.query(sql, [inventoryItemId]);
  }

  static async lockAndGetCostState(inventoryItemId: string, client: PoolClient): Promise<InventoryCostState> {
    await this.ensureCostStateRow(inventoryItemId, client);
    const sql = `
      SELECT * 
      FROM inventory_cost_state 
      WHERE inventory_item_id = $1 
      FOR UPDATE;
    `;
    const { rows } = await client.query(sql, [inventoryItemId]);
    return {
      inventory_item_id: rows[0].inventory_item_id,
      average_unit_cost: String(rows[0].average_unit_cost),
      quantity_on_cost_basis: String(rows[0].quantity_on_cost_basis),
      updated_at: rows[0].updated_at
    };
  }

  static async getCostState(inventoryItemId: string, client?: PoolClient): Promise<InventoryCostState | null> {
    const db = this.getExecutor(client);
    const sql = `SELECT * FROM inventory_cost_state WHERE inventory_item_id = $1;`;
    const { rows } = await db.query(sql, [inventoryItemId]);
    if (!rows[0]) return null;
    return {
      inventory_item_id: rows[0].inventory_item_id,
      average_unit_cost: String(rows[0].average_unit_cost),
      quantity_on_cost_basis: String(rows[0].quantity_on_cost_basis),
      updated_at: rows[0].updated_at
    };
  }

  static async updateCostState(
    inventoryItemId: string,
    averageUnitCost: Decimal,
    quantityOnCostBasis: Decimal,
    client: PoolClient
  ): Promise<InventoryCostState> {
    const sql = `
      UPDATE inventory_cost_state
      SET average_unit_cost = $1,
          quantity_on_cost_basis = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE inventory_item_id = $3
      RETURNING *;
    `;
    const { rows } = await client.query(sql, [
      averageUnitCost.toFixed(4),
      quantityOnCostBasis.toFixed(3),
      inventoryItemId
    ]);
    return {
      inventory_item_id: rows[0].inventory_item_id,
      average_unit_cost: String(rows[0].average_unit_cost),
      quantity_on_cost_basis: String(rows[0].quantity_on_cost_basis),
      updated_at: rows[0].updated_at
    };
  }

  static async insertBillConsumption(
    params: {
      billId: string;
      billLineId: string;
      inventoryItemId: string;
      recipeVersionId: string;
      quantityConsumed: string;
      unitCostSnapshot: string | null;
      totalCostSnapshot: string | null;
      stockMovementId: string;
    },
    client: PoolClient
  ): Promise<BillConsumption> {
    const sql = `
      INSERT INTO bill_consumptions (
        bill_id,
        bill_line_id,
        inventory_item_id,
        recipe_version_id,
        quantity_consumed,
        unit_cost_snapshot,
        total_cost_snapshot,
        stock_movement_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const { rows } = await client.query(sql, [
      params.billId,
      params.billLineId,
      params.inventoryItemId,
      params.recipeVersionId,
      params.quantityConsumed,
      params.unitCostSnapshot,
      params.totalCostSnapshot,
      params.stockMovementId
    ]);
    return rows[0];
  }

  static async insertBillCostCoverage(
    params: {
      billId: string;
      totalBillLines: number;
      coveredLines: number;
      missingRecipeLines: number;
      missingCostLines: number;
      negativeStockOverrideUsed?: boolean;
    },
    client: PoolClient
  ): Promise<BillCostCoverage> {
    const sql = `
      INSERT INTO bill_cost_coverage (
        bill_id,
        total_bill_lines,
        covered_lines,
        missing_recipe_lines,
        missing_cost_lines,
        negative_stock_override_used
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const { rows } = await client.query(sql, [
      params.billId,
      params.totalBillLines,
      params.coveredLines,
      params.missingRecipeLines,
      params.missingCostLines,
      params.negativeStockOverrideUsed || false
    ]);
    return rows[0];
  }

  static async findConsumptionsByBillId(billId: string, client?: PoolClient): Promise<BillConsumption[]> {
    const db = this.getExecutor(client);
    const sql = `
      SELECT * 
      FROM bill_consumptions 
      WHERE bill_id = $1 
      ORDER BY created_at ASC;
    `;
    const { rows } = await db.query(sql, [billId]);
    return rows;
  }

  static async findCoverageByBillId(billId: string, client?: PoolClient): Promise<BillCostCoverage | null> {
    const db = this.getExecutor(client);
    const sql = `SELECT * FROM bill_cost_coverage WHERE bill_id = $1;`;
    const { rows } = await db.query(sql, [billId]);
    return rows[0] || null;
  }
}
