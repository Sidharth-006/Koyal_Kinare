// analytics.repository.ts — Phase 3 Module 4
// All DB queries for P&L, analytics overview, and menu performance.
// READ ONLY — does NOT mutate any operational data.

import { query } from '@/shared/database/client';

export class AnalyticsRepository {
  // ============================================================
  // P&L CORE AGGREGATIONS
  // ============================================================

  /**
   * Aggregates completed non-voided bills for the period.
   * Returns grossRevenue (subtotal), totalDiscount, totalTax, grandTotal, billCount.
   * Voided bills are excluded via LEFT JOIN on bill_voids.
   */
  static async getBillsSummary(from: string, to: string) {
    const sql = `
      SELECT
        COUNT(b.id)::int                                    AS bill_count,
        COALESCE(SUM(b.subtotal),    0.00)                 AS gross_revenue,
        COALESCE(SUM(b.discount),    0.00)                 AS total_discount,
        COALESCE(SUM(b.tax),         0.00)                 AS total_tax,
        COALESCE(SUM(b.grand_total), 0.00)                 AS grand_total,
        COALESCE(SUM(p.cash_total),  0.00)                 AS cash_total,
        COALESCE(SUM(p.upi_total),   0.00)                 AS upi_total,
        COALESCE(SUM(p.card_total),  0.00)                 AS card_total
      FROM bills b
      LEFT JOIN bill_voids bv ON b.id = bv.bill_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN amount ELSE 0 END), 0) AS cash_total,
          COALESCE(SUM(CASE WHEN payment_method = 'UPI'  THEN amount ELSE 0 END), 0) AS upi_total,
          COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN amount ELSE 0 END), 0) AS card_total
        FROM payments
        WHERE bill_id = b.id AND status = 'COMPLETED'
      ) p ON true
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED'
        AND bv.bill_id IS NULL;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows[0];
  }

  /**
   * Count voided bills in period (for analytics overview exceptions).
   */
  static async getVoidedBillCount(from: string, to: string): Promise<number> {
    const sql = `
      SELECT COUNT(b.id)::int AS voided_count
      FROM bills b
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'VOIDED';
    `;
    const { rows } = await query(sql, [from, to]);
    return parseInt(rows[0]?.voided_count ?? '0', 10);
  }

  /**
   * Food cost aggregation from bill_consumptions (authoritative DLD source).
   * Only sums non-NULL total_cost_snapshot for completed non-voided bills.
   * NULL rows are counted separately for completeness model.
   */
  static async getFoodCostAggregation(from: string, to: string) {
    const sql = `
      SELECT
        COALESCE(SUM(CASE WHEN bc.total_cost_snapshot IS NOT NULL THEN bc.total_cost_snapshot ELSE 0 END), 0.00)
            AS food_cost,
        COUNT(CASE WHEN bc.total_cost_snapshot IS NULL THEN 1 END)::int
            AS missing_cost_rows,
        COUNT(bc.id)::int
            AS total_consumption_rows
      FROM bill_consumptions bc
      JOIN bills b ON bc.bill_id = b.id
      LEFT JOIN bill_voids bv ON b.id = bv.bill_id
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED'
        AND bv.bill_id IS NULL;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows[0];
  }

  /**
   * Completeness aggregation from bill_cost_coverage for completed non-voided bills.
   */
  static async getCoverageAggregation(from: string, to: string) {
    const sql = `
      SELECT
        COALESCE(SUM(bcc.total_bill_lines),       0)::int AS total_bill_lines,
        COALESCE(SUM(bcc.covered_lines),          0)::int AS covered_lines,
        COALESCE(SUM(bcc.missing_recipe_lines),   0)::int AS missing_recipe_lines,
        COALESCE(SUM(bcc.missing_cost_lines),     0)::int AS missing_cost_lines,
        COUNT(CASE WHEN bcc.negative_stock_override_used = TRUE THEN 1 END)::int
            AS negative_stock_exception_count
      FROM bill_cost_coverage bcc
      JOIN bills b ON bcc.bill_id = b.id
      LEFT JOIN bill_voids bv ON b.id = bv.bill_id
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED'
        AND bv.bill_id IS NULL;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows[0];
  }

  /**
   * Revenue amount associated with bill lines that have NO consumption record
   * (i.e., missing recipe coverage). Used for the completeness model.
   */
  static async getMissingRecipeSalesAmount(from: string, to: string): Promise<string> {
    const sql = `
      SELECT COALESCE(SUM(bl.total), 0.00) AS missing_recipe_sales
      FROM bill_lines bl
      JOIN bills b ON bl.bill_id = b.id
      LEFT JOIN bill_voids bv ON b.id = bv.bill_id
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED'
        AND bv.bill_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM bill_consumptions bc WHERE bc.bill_line_id = bl.id
        );
    `;
    const { rows } = await query(sql, [from, to]);
    return String(rows[0]?.missing_recipe_sales ?? '0.00');
  }

  /**
   * Operating expenses: non-voided expenses for the period.
   */
  static async getOperatingExpenses(from: string, to: string) {
    const sql = `
      SELECT
        COALESCE(SUM(amount), 0.00)   AS total_expenses,
        COUNT(id)::int                AS expense_count
      FROM expenses
      WHERE business_date >= $1
        AND business_date <= $2
        AND is_voided = FALSE;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows[0];
  }

  /**
   * Expenses broken down by category (for analytics overview).
   */
  static async getExpensesByCategory(from: string, to: string) {
    const sql = `
      SELECT category, COALESCE(SUM(amount), 0.00) AS total
      FROM expenses
      WHERE business_date >= $1
        AND business_date <= $2
        AND is_voided = FALSE
      GROUP BY category
      ORDER BY total DESC;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows;
  }

  /**
   * Wastage and count-correction physical shrinkage indicators.
   * Read-only, non-mutating physical metrics.
   */
  static async getWastageIndicators(from: string, to: string) {
    const sql = `
      SELECT 
        COUNT(CASE WHEN movement_type = 'WASTAGE' THEN 1 END)::int AS wastage_count,
        COALESCE(SUM(CASE WHEN movement_type = 'WASTAGE' THEN ABS(quantity_delta) ELSE 0.000 END), 0.000) AS wastage_quantity,
        COUNT(CASE WHEN movement_type = 'COUNT_CORRECTION' AND quantity_delta < 0 THEN 1 END)::int AS count_correction_deficit_count,
        COALESCE(SUM(CASE WHEN movement_type = 'COUNT_CORRECTION' AND quantity_delta < 0 THEN ABS(quantity_delta) ELSE 0.000 END), 0.000) AS count_correction_deficit_quantity
      FROM stock_movements
      WHERE business_date >= $1 AND business_date <= $2;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows[0];
  }

  // ============================================================
  // MENU PERFORMANCE
  // ============================================================

  /**
   * Per-item performance aggregation.
   * Revenue from bill_lines (historic snapshot).
   * Food cost from bill_consumptions (authoritative).
   * NULL food cost = missing data (not fabricated).
   */
  static async getMenuPerformance(from: string, to: string) {
    const sql = `
      SELECT
        bl.menu_item_id,
        bl.item_name,
        bl.category_name,
        SUM(bl.quantity)::int                                           AS total_quantity,
        COALESCE(SUM(bl.total), 0.00)                                   AS total_revenue,
        SUM(bc_agg.item_food_cost)                                      AS food_cost,
        COUNT(CASE WHEN bc_agg.item_food_cost IS NULL THEN 1 END)::int  AS lines_missing_cost,
        SUM(bcc_agg.covered)::int                                       AS covered_count,
        SUM(bcc_agg.missing_recipe)::int                                AS missing_recipe_count
      FROM bill_lines bl
      JOIN bills b ON bl.bill_id = b.id
      LEFT JOIN bill_voids bv ON b.id = bv.bill_id
      LEFT JOIN LATERAL (
        SELECT
          CASE
            WHEN COUNT(*) = 0 THEN NULL
            WHEN COUNT(CASE WHEN bc.total_cost_snapshot IS NULL THEN 1 END) > 0 THEN NULL
            ELSE SUM(bc.total_cost_snapshot)
          END AS item_food_cost
        FROM bill_consumptions bc
        WHERE bc.bill_line_id = bl.id
      ) bc_agg ON true
      LEFT JOIN LATERAL (
        SELECT
          CASE WHEN EXISTS (SELECT 1 FROM bill_consumptions bc2 WHERE bc2.bill_line_id = bl.id) THEN 1 ELSE 0 END AS covered,
          CASE WHEN NOT EXISTS (SELECT 1 FROM bill_consumptions bc3 WHERE bc3.bill_line_id = bl.id) THEN 1 ELSE 0 END AS missing_recipe
        FROM (SELECT 1) dummy
      ) bcc_agg ON true
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED'
        AND bv.bill_id IS NULL
      GROUP BY bl.menu_item_id, bl.item_name, bl.category_name;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows;
  }

  // ============================================================
  // MONTHLY P&L BREAKDOWN
  // ============================================================

  /**
   * Monthly aggregation of bills (bills.subtotal/discount/tax) for P&L per month.
   */
  static async getMonthlyBillsSummary(from: string, to: string) {
    const sql = `
      SELECT
        TO_CHAR(b.business_date, 'YYYY-MM')          AS year_month,
        COUNT(b.id)::int                             AS bill_count,
        COALESCE(SUM(b.subtotal),    0.00)           AS gross_revenue,
        COALESCE(SUM(b.discount),    0.00)           AS total_discount,
        COALESCE(SUM(b.tax),         0.00)           AS total_tax
      FROM bills b
      LEFT JOIN bill_voids bv ON b.id = bv.bill_id
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED'
        AND bv.bill_id IS NULL
      GROUP BY year_month
      ORDER BY year_month ASC;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows;
  }

  /**
   * Monthly food cost aggregation from bill_consumptions.
   */
  static async getMonthlyFoodCost(from: string, to: string) {
    const sql = `
      SELECT
        TO_CHAR(b.business_date, 'YYYY-MM')  AS year_month,
        COALESCE(SUM(CASE WHEN bc.total_cost_snapshot IS NOT NULL THEN bc.total_cost_snapshot ELSE 0 END), 0.00)
            AS food_cost,
        COUNT(CASE WHEN bc.total_cost_snapshot IS NULL THEN 1 END)::int AS missing_cost_rows,
        COUNT(bc.id)::int AS total_consumption_rows
      FROM bill_consumptions bc
      JOIN bills b ON bc.bill_id = b.id
      LEFT JOIN bill_voids bv ON b.id = bv.bill_id
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED'
        AND bv.bill_id IS NULL
      GROUP BY year_month
      ORDER BY year_month ASC;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows;
  }

  /**
   * Monthly coverage aggregation from bill_cost_coverage.
   */
  static async getMonthlyCoverage(from: string, to: string) {
    const sql = `
      SELECT
        TO_CHAR(b.business_date, 'YYYY-MM')  AS year_month,
        COALESCE(SUM(bcc.total_bill_lines),     0)::int AS total_bill_lines,
        COALESCE(SUM(bcc.covered_lines),        0)::int AS covered_lines,
        COALESCE(SUM(bcc.missing_recipe_lines), 0)::int AS missing_recipe_lines,
        COALESCE(SUM(bcc.missing_cost_lines),   0)::int AS missing_cost_lines,
        COUNT(CASE WHEN bcc.negative_stock_override_used = TRUE THEN 1 END)::int
            AS negative_stock_exception_count
      FROM bill_cost_coverage bcc
      JOIN bills b ON bcc.bill_id = b.id
      LEFT JOIN bill_voids bv ON b.id = bv.bill_id
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED'
        AND bv.bill_id IS NULL
      GROUP BY year_month
      ORDER BY year_month ASC;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows;
  }

  /**
   * Monthly expenses aggregation.
   */
  static async getMonthlyExpenses(from: string, to: string) {
    const sql = `
      SELECT
        TO_CHAR(business_date, 'YYYY-MM')  AS year_month,
        COALESCE(SUM(amount), 0.00)        AS total_expenses
      FROM expenses
      WHERE business_date >= $1
        AND business_date <= $2
        AND is_voided = FALSE
      GROUP BY year_month
      ORDER BY year_month ASC;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows;
  }

  // ============================================================
  // INVENTORY VALUATION (Current state — no historical support)
  // ============================================================

  static async getInventoryValuation() {
    const sql = `
      SELECT
        i.id,
        i.name,
        i.item_type,
        i.base_unit,
        COALESCE(ib.available_quantity, 0.000)    AS current_quantity,
        ics.average_unit_cost
      FROM inventory_items i
      LEFT JOIN inventory_balances ib ON i.id = ib.inventory_item_id
      LEFT JOIN inventory_cost_state ics ON i.id = ics.inventory_item_id
      WHERE i.is_archived = FALSE
      ORDER BY i.name ASC;
    `;
    const { rows } = await query(sql);
    return rows;
  }

  // ============================================================
  // RECONCILIATION RANGE
  // ============================================================

  /**
   * Returns per-day reconciliation data across a date range.
   * Joins daily_closings, cash_openings, and live payment/expense/purchase aggregates.
   * Consistent with ReconciliationService.getReconciliationPreview() per-day logic.
   */
  static async getReconciliationRange(from: string, to: string) {
    const sql = `
      WITH date_series AS (
        SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS business_date
      ),
      cash_sales AS (
        SELECT b.business_date, COALESCE(SUM(p.amount), 0.00) AS total
        FROM payments p
        JOIN bills b ON p.bill_id = b.id
        WHERE b.business_date >= $1 AND b.business_date <= $2
          AND b.status = 'COMPLETED' AND p.status = 'COMPLETED' AND p.payment_method = 'CASH'
        GROUP BY b.business_date
      ),
      upi_sales AS (
        SELECT b.business_date, COALESCE(SUM(p.amount), 0.00) AS total
        FROM payments p
        JOIN bills b ON p.bill_id = b.id
        WHERE b.business_date >= $1 AND b.business_date <= $2
          AND b.status = 'COMPLETED' AND p.status = 'COMPLETED' AND p.payment_method = 'UPI'
        GROUP BY b.business_date
      ),
      card_sales AS (
        SELECT b.business_date, COALESCE(SUM(p.amount), 0.00) AS total
        FROM payments p
        JOIN bills b ON p.bill_id = b.id
        WHERE b.business_date >= $1 AND b.business_date <= $2
          AND b.status = 'COMPLETED' AND p.status = 'COMPLETED' AND p.payment_method = 'CARD'
        GROUP BY b.business_date
      ),
      cash_expenses AS (
        SELECT business_date, COALESCE(SUM(amount), 0.00) AS total
        FROM expenses
        WHERE business_date >= $1 AND business_date <= $2
          AND is_voided = FALSE AND payment_method = 'CASH'
        GROUP BY business_date
      ),
      cash_purchases AS (
        SELECT purchase_date AS business_date, COALESCE(SUM(grand_total), 0.00) AS total
        FROM purchases
        WHERE purchase_date >= $1 AND purchase_date <= $2
          AND status = 'RECEIVED' AND payment_method = 'CASH'
        GROUP BY purchase_date
      )
      SELECT
        ds.business_date,
        COALESCE(co.opening_cash, '0.00')   AS opening_cash,
        COALESCE(cs.total, 0.00)            AS cash_sales,
        COALESCE(ce.total, 0.00)            AS cash_expenses,
        COALESCE(cp.total, 0.00)            AS cash_purchases,
        COALESCE(us.total, 0.00)            AS upi_sales,
        COALESCE(cas.total, 0.00)           AS card_sales,
        -- Settlement records
        upi_set.settlement_amount           AS upi_settlement,
        upi_set.difference                  AS upi_difference,
        card_set.settlement_amount          AS card_settlement,
        card_set.difference                 AS card_difference,
        -- Daily closing record
        dc.actual_cash,
        dc.cash_difference,
        COALESCE(dc.status, 'OPEN')         AS status
      FROM date_series ds
      LEFT JOIN cash_openings co ON co.business_date = ds.business_date
      LEFT JOIN cash_sales cs ON cs.business_date = ds.business_date
      LEFT JOIN upi_sales us ON us.business_date = ds.business_date
      LEFT JOIN card_sales cas ON cas.business_date = ds.business_date
      LEFT JOIN cash_expenses ce ON ce.business_date = ds.business_date
      LEFT JOIN cash_purchases cp ON cp.business_date = ds.business_date
      LEFT JOIN settlements upi_set ON upi_set.business_date = ds.business_date AND upi_set.method = 'UPI'
      LEFT JOIN settlements card_set ON card_set.business_date = ds.business_date AND card_set.method = 'CARD'
      LEFT JOIN daily_closings dc ON dc.business_date = ds.business_date
      ORDER BY ds.business_date ASC;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows;
  }
}
