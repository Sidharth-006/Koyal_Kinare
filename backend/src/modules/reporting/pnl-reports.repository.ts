// pnl-reports.repository.ts — Phase 3 Module 4
// SQL queries for CA registers: sales, purchase, expense.
// READ ONLY — uses historic bill/purchase/expense snapshots.

import { query } from '@/shared/database/client';

export class PnlReportsRepository {
  // ============================================================
  // SALES REGISTER
  // ============================================================

  /**
   * Sales register: per-bill rows with historic tax snapshot from bill_lines.
   * Includes voided bills with status flag (DLD: expose status and historic values).
   */
  static async getSalesRegister(from: string, to: string) {
    const sql = `
      SELECT
        b.id                    AS bill_id,
        b.bill_number,
        b.business_date,
        b.order_type,
        b.subtotal,
        b.discount,
        b.tax,
        b.grand_total,
        b.status,
        b.completed_at,
        -- Historic tax rate snapshot: MAX across lines (all lines share same rate at bill time)
        (
          SELECT MAX(bl.tax_rate)
          FROM bill_lines bl
          WHERE bl.bill_id = b.id
          LIMIT 1
        )                       AS tax_rate_snapshot,
        -- Payment info as JSON array
        (
          SELECT json_agg(json_build_object(
            'method', p.payment_method,
            'amount', p.amount::text
          ) ORDER BY p.created_at)
          FROM payments p
          WHERE p.bill_id = b.id AND p.status = 'COMPLETED'
        )                       AS payments_json
      FROM bills b
      WHERE b.business_date >= $1
        AND b.business_date <= $2
      ORDER BY b.business_date ASC, b.created_at ASC;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows;
  }

  // ============================================================
  // PURCHASE REGISTER
  // ============================================================

  /**
   * Purchase register: per-purchase rows with historic tax snapshots from purchase_lines.
   * Shows all statuses; DLD requires historic tax snapshot values.
   */
  static async getPurchaseRegister(from: string, to: string) {
    const sql = `
      SELECT
        p.id                    AS purchase_id,
        p.purchase_number,
        p.supplier_name,
        p.invoice_number,
        p.purchase_date,
        p.payment_method,
        p.discount,
        p.tax_amount,
        p.grand_total,
        p.status,
        p.received_at,
        -- Historic tax rate snapshot from purchase_lines (weighted avg across lines)
        (
          SELECT AVG(pl.tax_rate)
          FROM purchase_lines pl
          WHERE pl.purchase_id = p.id
        )                       AS tax_rate_snapshot,
        -- Individual line tax breakdown
        (
          SELECT json_agg(json_build_object(
            'item_name', pl.item_name,
            'quantity', pl.quantity::text,
            'unit_rate', pl.unit_rate::text,
            'tax_rate', pl.tax_rate::text,
            'line_total', pl.line_total::text
          ) ORDER BY pl.created_at)
          FROM purchase_lines pl
          WHERE pl.purchase_id = p.id
        )                       AS lines_json
      FROM purchases p
      WHERE p.purchase_date >= $1
        AND p.purchase_date <= $2
      ORDER BY p.purchase_date ASC, p.created_at ASC;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows;
  }

  // ============================================================
  // EXPENSE REGISTER
  // ============================================================

  /**
   * Expense register: all expenses (including voided) for the period.
   * Returns attachment reference where applicable.
   */
  static async getExpenseRegister(from: string, to: string) {
    const sql = `
      SELECT
        e.id                    AS expense_id,
        e.business_date,
        e.category,
        e.amount,
        e.payment_method,
        e.description,
        e.is_voided,
        e.void_reason,
        e.created_at,
        a.file_name             AS attachment_file_name,
        a.id                    AS attachment_id
      FROM expenses e
      LEFT JOIN attachments a ON e.attachment_id = a.id
      WHERE e.business_date >= $1
        AND e.business_date <= $2
      ORDER BY e.business_date ASC, e.created_at ASC;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows;
  }

  // ============================================================
  // SUMMARY QUERIES (for export metadata)
  // ============================================================

  static async getSalesRegisterSummary(from: string, to: string) {
    const sql = `
      SELECT
        COUNT(b.id)::int                                AS total_bills,
        COUNT(CASE WHEN b.status = 'COMPLETED' THEN 1 END)::int AS completed_bills,
        COUNT(CASE WHEN b.status = 'VOIDED' THEN 1 END)::int    AS voided_bills,
        COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' AND bv.bill_id IS NULL THEN b.subtotal ELSE 0 END), 0.00)
            AS total_gross_revenue,
        COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' AND bv.bill_id IS NULL THEN b.discount ELSE 0 END), 0.00)
            AS total_discounts,
        COALESCE(SUM(CASE WHEN b.status = 'COMPLETED' AND bv.bill_id IS NULL THEN b.tax ELSE 0 END), 0.00)
            AS total_tax
      FROM bills b
      LEFT JOIN bill_voids bv ON b.id = bv.bill_id
      WHERE b.business_date >= $1
        AND b.business_date <= $2;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows[0];
  }

  static async getPurchaseRegisterSummary(from: string, to: string) {
    const sql = `
      SELECT
        COUNT(id)::int                                           AS total_purchases,
        COALESCE(SUM(CASE WHEN status = 'RECEIVED' THEN grand_total ELSE 0 END), 0.00)
            AS received_total,
        COALESCE(SUM(CASE WHEN status = 'RECEIVED' THEN tax_amount ELSE 0 END), 0.00)
            AS tax_total,
        COALESCE(SUM(CASE WHEN status = 'RECEIVED' THEN discount ELSE 0 END), 0.00)
            AS discount_total
      FROM purchases
      WHERE purchase_date >= $1
        AND purchase_date <= $2;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows[0];
  }

  static async getExpenseRegisterSummary(from: string, to: string) {
    const sql = `
      SELECT
        COUNT(id)::int                                           AS total_expenses,
        COALESCE(SUM(CASE WHEN is_voided = FALSE THEN amount ELSE 0 END), 0.00)
            AS active_total,
        COUNT(CASE WHEN is_voided = TRUE THEN 1 END)::int       AS voided_count
      FROM expenses
      WHERE business_date >= $1
        AND business_date <= $2;
    `;
    const { rows } = await query(sql, [from, to]);
    return rows[0];
  }

  static async getExpenseRegisterByCategory(from: string, to: string) {
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
}
