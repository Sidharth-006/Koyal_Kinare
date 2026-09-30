import { query } from '@/shared/database/client';
import { PoolClient } from 'pg';

export interface LowStockAcknowledgement {
  id: string;
  inventory_item_id: string;
  inventoryItemId: string;
  balance_snapshot: string;
  balanceSnapshot: string;
  acknowledged_by: string;
  acknowledgedBy: string;
  acknowledged_at: string;
  acknowledgedAt: string;
  note: string | null;
  admin_name?: string | null;
  adminName?: string | null;
}

export interface LowStockItem {
  id: string;
  name: string;
  item_type: string;
  itemType: string;
  base_unit: string;
  baseUnit: string;
  current_quantity: string;
  currentQuantity: string;
  minimum_quantity: string;
  minimumQuantity: string;
  last_movement: string | null;
  lastMovement: string | null;
  latest_acknowledgement: LowStockAcknowledgement | null;
  latestAcknowledgement: LowStockAcknowledgement | null;
}

export class InventoryAlertsRepository {
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

  static async getOverviewCounts(client?: PoolClient) {
    const db = this.getExecutor(client);

    const [activeItemsRes, lowStockRes, recentPurchasesRes, recentMovementsRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int as count FROM inventory_items WHERE is_archived = FALSE;`),
      db.query(`
        SELECT COUNT(*)::int as count
        FROM inventory_items i
        LEFT JOIN inventory_balances b ON i.id = b.inventory_item_id
        WHERE i.is_archived = FALSE
          AND COALESCE(b.available_quantity, 0.000) <= i.minimum_stock;
      `),
      db.query(`
        SELECT id, purchase_number, supplier_name, purchase_date, payment_method, grand_total, status, received_at
        FROM purchases
        WHERE status = 'RECEIVED'
        ORDER BY received_at DESC NULLS LAST, purchase_date DESC, created_at DESC
        LIMIT 5;
      `),
      db.query(`
        SELECT m.id, m.inventory_item_id, i.name as item_name, i.base_unit, m.business_date,
               m.movement_type, m.quantity_delta, m.unit_cost, m.source_type, m.source_id, m.reason, m.created_at
        FROM stock_movements m
        JOIN inventory_items i ON m.inventory_item_id = i.id
        ORDER BY m.business_date DESC, m.created_at DESC
        LIMIT 5;
      `)
    ]);

    return {
      totalActiveItems: activeItemsRes.rows[0]?.count || 0,
      activeLowStockCount: lowStockRes.rows[0]?.count || 0,
      recentPurchases: recentPurchasesRes.rows.map((r: any) => ({
        id: r.id,
        purchaseNumber: r.purchase_number,
        supplierName: r.supplier_name,
        purchaseDate: typeof r.purchase_date === 'string' ? r.purchase_date.substring(0, 10) : new Date(r.purchase_date).toISOString().substring(0, 10),
        paymentMethod: r.payment_method,
        grandTotal: String(r.grand_total),
        status: r.status,
        receivedAt: r.received_at
      })),
      recentMovements: recentMovementsRes.rows.map((r: any) => ({
        id: r.id,
        inventoryItemId: r.inventory_item_id,
        itemName: r.item_name,
        baseUnit: r.base_unit,
        businessDate: typeof r.business_date === 'string' ? r.business_date.substring(0, 10) : new Date(r.business_date).toISOString().substring(0, 10),
        movementType: r.movement_type,
        quantityDelta: String(r.quantity_delta),
        unitCost: r.unit_cost !== null && r.unit_cost !== undefined ? String(r.unit_cost) : null,
        sourceType: r.source_type,
        sourceId: r.source_id,
        reason: r.reason || null,
        createdAt: r.created_at
      }))
    };
  }

  static async getLowStockItems(params: { page: number; pageSize: number }, client?: PoolClient) {
    const db = this.getExecutor(client);
    const offset = (params.page - 1) * params.pageSize;

    const countSql = `
      SELECT COUNT(*)::int as total
      FROM inventory_items i
      LEFT JOIN inventory_balances b ON i.id = b.inventory_item_id
      WHERE i.is_archived = FALSE
        AND COALESCE(b.available_quantity, 0.000) <= i.minimum_stock;
    `;
    const countRes = await db.query(countSql);
    const total = countRes.rows[0]?.total || 0;

    const dataSql = `
      SELECT 
        i.id,
        i.name,
        i.item_type,
        i.base_unit,
        COALESCE(b.available_quantity, 0.000) as current_quantity,
        i.minimum_stock as minimum_quantity,
        b.last_movement_at as last_movement,
        ack.id as ack_id,
        ack.balance_snapshot as ack_balance_snapshot,
        ack.note as ack_note,
        ack.acknowledged_at as ack_acknowledged_at,
        ack.acknowledged_by as ack_acknowledged_by,
        adm.display_name as ack_admin_name
      FROM inventory_items i
      LEFT JOIN inventory_balances b ON i.id = b.inventory_item_id
      LEFT JOIN LATERAL (
        SELECT a.id, a.balance_snapshot, a.note, a.acknowledged_at, a.acknowledged_by
        FROM low_stock_alert_acknowledgements a
        WHERE a.inventory_item_id = i.id
        ORDER BY a.acknowledged_at DESC
        LIMIT 1
      ) ack ON true
      LEFT JOIN admins adm ON ack.acknowledged_by = adm.id
      WHERE i.is_archived = FALSE
        AND COALESCE(b.available_quantity, 0.000) <= i.minimum_stock
      ORDER BY (i.minimum_stock - COALESCE(b.available_quantity, 0.000)) DESC, i.name ASC
      LIMIT $1 OFFSET $2;
    `;
    const { rows } = await db.query(dataSql, [params.pageSize, offset]);

    const items: LowStockItem[] = rows.map((r: any) => {
      const ack: LowStockAcknowledgement | null = r.ack_id ? {
        id: r.ack_id,
        inventory_item_id: r.id,
        inventoryItemId: r.id,
        balance_snapshot: String(r.ack_balance_snapshot),
        balanceSnapshot: String(r.ack_balance_snapshot),
        acknowledged_by: r.ack_acknowledged_by,
        acknowledgedBy: r.ack_acknowledged_by,
        acknowledged_at: r.ack_acknowledged_at,
        acknowledgedAt: r.ack_acknowledged_at,
        note: r.ack_note || null,
        admin_name: r.ack_admin_name || null,
        adminName: r.ack_admin_name || null
      } : null;

      return {
        id: r.id,
        name: r.name,
        item_type: r.item_type,
        itemType: r.item_type,
        base_unit: r.base_unit,
        baseUnit: r.base_unit,
        current_quantity: String(r.current_quantity),
        currentQuantity: String(r.current_quantity),
        minimum_quantity: String(r.minimum_quantity),
        minimumQuantity: String(r.minimum_quantity),
        last_movement: r.last_movement,
        lastMovement: r.last_movement,
        latest_acknowledgement: ack,
        latestAcknowledgement: ack
      };
    });

    const totalPages = Math.ceil(total / params.pageSize) || (total === 0 ? 0 : 1);

    return {
      items,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages
      }
    };
  }

  static async getItemWithBalance(itemId: string, client?: PoolClient) {
    const db = this.getExecutor(client);
    const sql = `
      SELECT 
        i.id,
        i.name,
        i.item_type,
        i.base_unit,
        i.minimum_stock,
        i.is_archived,
        COALESCE(b.available_quantity, 0.000) as available_quantity
      FROM inventory_items i
      LEFT JOIN inventory_balances b ON i.id = b.inventory_item_id
      WHERE i.id = $1;
    `;
    const { rows } = await db.query(sql, [itemId]);
    return rows[0] || null;
  }

  static async createAcknowledgement(
    params: {
      inventoryItemId: string;
      balanceSnapshot: string;
      note?: string | null;
      acknowledgedBy: string;
    },
    client?: PoolClient
  ): Promise<LowStockAcknowledgement> {
    const db = this.getExecutor(client);
    const sql = `
      INSERT INTO low_stock_alert_acknowledgements (
        inventory_item_id,
        balance_snapshot,
        note,
        acknowledged_by
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [
      params.inventoryItemId,
      params.balanceSnapshot,
      params.note?.trim() || null,
      params.acknowledgedBy
    ]);
    const r = rows[0];
    return {
      id: r.id,
      inventory_item_id: r.inventory_item_id,
      inventoryItemId: r.inventory_item_id,
      balance_snapshot: String(r.balance_snapshot),
      balanceSnapshot: String(r.balance_snapshot),
      acknowledged_by: r.acknowledged_by,
      acknowledgedBy: r.acknowledged_by,
      acknowledged_at: r.acknowledged_at,
      acknowledgedAt: r.acknowledged_at,
      note: r.note || null
    };
  }
}
