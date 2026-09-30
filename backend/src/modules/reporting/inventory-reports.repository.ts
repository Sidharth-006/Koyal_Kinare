import { query } from '@/shared/database/client';
import { PoolClient } from 'pg';

export class InventoryReportsRepository {
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

  static async getInventoryStockSnapshot(asOfDate?: string, client?: PoolClient) {
    const db = this.getExecutor(client);
    const sql = `
      SELECT 
        i.id,
        i.name,
        i.item_type,
        i.base_unit,
        i.minimum_stock,
        COALESCE(b.available_quantity, 0.000) as current_quantity,
        b.last_movement_at,
        rate_q.unit_rate as latest_unit_cost
      FROM inventory_items i
      LEFT JOIN inventory_balances b ON i.id = b.inventory_item_id
      LEFT JOIN LATERAL (
        SELECT pl.unit_rate
        FROM purchase_lines pl
        JOIN purchases p ON pl.purchase_id = p.id
        WHERE pl.inventory_item_id = i.id
          AND p.status = 'RECEIVED'
        ORDER BY p.purchase_date DESC, p.created_at DESC
        LIMIT 1
      ) rate_q ON true
      WHERE i.is_archived = FALSE
      ORDER BY i.name ASC;
    `;
    const { rows } = await db.query(sql);
    return rows;
  }

  static async getStockMovements(
    filters: { from: string; to: string; itemId?: string; movementType?: string },
    client?: PoolClient
  ) {
    const db = this.getExecutor(client);
    const conditions: string[] = ['m.business_date >= $1', 'm.business_date <= $2'];
    const params: any[] = [filters.from, filters.to];
    let idx = 3;

    if (filters.itemId) {
      conditions.push(`m.inventory_item_id = $${idx++}`);
      params.push(filters.itemId);
    }
    if (filters.movementType) {
      conditions.push(`m.movement_type = $${idx++}`);
      params.push(filters.movementType);
    }

    const sql = `
      SELECT 
        m.id,
        m.inventory_item_id,
        i.name as item_name,
        i.base_unit,
        m.business_date,
        m.movement_type,
        m.quantity_delta,
        m.unit_cost,
        m.source_type,
        m.source_id,
        m.reason,
        m.created_at,
        a.display_name as created_by_name
      FROM stock_movements m
      JOIN inventory_items i ON m.inventory_item_id = i.id
      LEFT JOIN admins a ON m.created_by = a.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.business_date DESC, m.created_at DESC;
    `;
    const { rows } = await db.query(sql, params);
    return rows;
  }

  static async getPurchasesReport(
    filters: { from: string; to: string; supplierId?: string; itemId?: string; paymentMethod?: string; status?: string },
    client?: PoolClient
  ) {
    const db = this.getExecutor(client);
    const conditions: string[] = ['p.purchase_date >= $1', 'p.purchase_date <= $2'];
    const params: any[] = [filters.from, filters.to];
    let idx = 3;

    if (filters.supplierId) {
      conditions.push(`p.supplier_id = $${idx++}`);
      params.push(filters.supplierId);
    }
    if (filters.paymentMethod) {
      conditions.push(`p.payment_method = $${idx++}`);
      params.push(filters.paymentMethod);
    }
    if (filters.status) {
      conditions.push(`p.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.itemId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM purchase_lines pl
        WHERE pl.purchase_id = p.id AND pl.inventory_item_id = $${idx++}
      )`);
      params.push(filters.itemId);
    }

    const sql = `
      SELECT 
        p.id,
        p.purchase_number,
        p.supplier_id,
        p.supplier_name,
        p.invoice_number,
        p.purchase_date,
        p.payment_method,
        p.discount,
        p.tax_amount,
        p.grand_total,
        p.status,
        p.received_at,
        p.created_at,
        s.phone as supplier_phone,
        s.email as supplier_email
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.purchase_date DESC, p.created_at DESC;
    `;
    const { rows } = await db.query(sql, params);
    return rows;
  }

  static async getSuppliersReport(
    filters: { from: string; to: string },
    client?: PoolClient
  ) {
    const db = this.getExecutor(client);
    const sql = `
      SELECT 
        s.id as supplier_id,
        s.name as supplier_name,
        s.contact_person,
        s.phone,
        s.email,
        s.is_archived,
        COUNT(p.id)::int as total_orders,
        COUNT(CASE WHEN p.status = 'RECEIVED' THEN 1 END)::int as received_orders,
        COALESCE(SUM(CASE WHEN p.status = 'RECEIVED' THEN p.grand_total ELSE 0.00 END), 0.00) as received_total,
        COUNT(CASE WHEN p.status = 'DRAFT' THEN 1 END)::int as draft_orders,
        COALESCE(SUM(CASE WHEN p.status = 'DRAFT' THEN p.grand_total ELSE 0.00 END), 0.00) as draft_total,
        COUNT(CASE WHEN p.status = 'REVERSED' THEN 1 END)::int as reversed_orders,
        COALESCE(SUM(CASE WHEN p.status = 'REVERSED' THEN p.grand_total ELSE 0.00 END), 0.00) as reversed_total,
        MAX(p.purchase_date) as last_purchase_date
      FROM suppliers s
      LEFT JOIN purchases p ON s.id = p.supplier_id 
        AND p.purchase_date >= $1 
        AND p.purchase_date <= $2
      GROUP BY s.id, s.name, s.contact_person, s.phone, s.email, s.is_archived
      HAVING COUNT(p.id) > 0 OR s.is_archived = FALSE
      ORDER BY received_total DESC, s.name ASC;
    `;
    const { rows } = await db.query(sql, [filters.from, filters.to]);
    return rows;
  }

  static async getWastageMovements(
    filters: { from: string; to: string },
    client?: PoolClient
  ) {
    const db = this.getExecutor(client);
    const sql = `
      SELECT 
        m.id,
        m.inventory_item_id,
        i.name as item_name,
        i.base_unit,
        m.business_date,
        m.movement_type,
        ABS(m.quantity_delta) as quantity_wasted,
        m.quantity_delta,
        m.unit_cost,
        m.source_type,
        m.source_id,
        m.reason,
        m.created_at,
        a.display_name as created_by_name
      FROM stock_movements m
      JOIN inventory_items i ON m.inventory_item_id = i.id
      LEFT JOIN admins a ON m.created_by = a.id
      WHERE m.business_date >= $1
        AND m.business_date <= $2
        AND m.movement_type IN ('WASTAGE', 'MANUAL_DECREASE', 'COUNT_CORRECTION')
        AND m.quantity_delta < 0
      ORDER BY m.business_date DESC, m.created_at DESC;
    `;
    const { rows } = await db.query(sql, [filters.from, filters.to]);
    return rows;
  }

  static async getProfitabilityPurchasesBreakdown(
    startDate: string,
    endDate: string,
    client?: PoolClient
  ) {
    const db = this.getExecutor(client);
    const sql = `
      SELECT 
        COALESCE(SUM(p.grand_total), 0.00) as total_received_purchases,
        COALESCE(SUM(CASE WHEN i.item_type = 'RAW_MATERIAL' THEN pl.line_total ELSE 0.00 END), 0.00) as raw_material_total,
        COALESCE(SUM(CASE WHEN i.item_type = 'PACKAGING' THEN pl.line_total ELSE 0.00 END), 0.00) as packaging_total,
        COALESCE(SUM(CASE WHEN i.item_type NOT IN ('RAW_MATERIAL', 'PACKAGING') THEN pl.line_total ELSE 0.00 END), 0.00) as other_total
      FROM purchases p
      LEFT JOIN purchase_lines pl ON p.id = pl.purchase_id
      LEFT JOIN inventory_items i ON pl.inventory_item_id = i.id
      WHERE p.purchase_date >= $1
        AND p.purchase_date <= $2
        AND p.status = 'RECEIVED';
    `;
    const { rows } = await db.query(sql, [startDate, endDate]);
    return rows[0];
  }

  static async getProfitabilityStockIndicators(
    startDate: string,
    endDate: string,
    client?: PoolClient
  ) {
    const db = this.getExecutor(client);
    const sql = `
      SELECT 
        COUNT(CASE WHEN movement_type = 'WASTAGE' THEN 1 END)::int as wastage_count,
        COALESCE(SUM(CASE WHEN movement_type = 'WASTAGE' THEN ABS(quantity_delta) ELSE 0.000 END), 0.000) as wastage_quantity,
        COUNT(CASE WHEN movement_type = 'MANUAL_DECREASE' THEN 1 END)::int as manual_decrease_count,
        COALESCE(SUM(CASE WHEN movement_type = 'MANUAL_DECREASE' THEN ABS(quantity_delta) ELSE 0.000 END), 0.000) as manual_decrease_quantity,
        COUNT(CASE WHEN movement_type = 'MANUAL_CONSUMPTION' THEN 1 END)::int as manual_consumption_count,
        COALESCE(SUM(CASE WHEN movement_type = 'MANUAL_CONSUMPTION' THEN ABS(quantity_delta) ELSE 0.000 END), 0.000) as manual_consumption_quantity,
        COUNT(CASE WHEN movement_type = 'COUNT_CORRECTION' AND quantity_delta < 0 THEN 1 END)::int as count_correction_deficit_count,
        COALESCE(SUM(CASE WHEN movement_type = 'COUNT_CORRECTION' AND quantity_delta < 0 THEN ABS(quantity_delta) ELSE 0.000 END), 0.000) as count_correction_deficit_quantity
      FROM stock_movements
      WHERE business_date >= $1
        AND business_date <= $2;
    `;
    const { rows } = await db.query(sql, [startDate, endDate]);
    return rows[0];
  }
}
