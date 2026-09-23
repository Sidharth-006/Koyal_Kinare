import { query } from '@/shared/database/client';

export class SalesRepository {
  static async getSalesSummary(startDate: string, endDate: string) {
    const text = `
      SELECT
        COALESCE(COUNT(b.id), 0) as bill_count,
        COALESCE(SUM(b.subtotal), 0.00) as total_subtotal,
        COALESCE(SUM(b.discount), 0.00) as total_discount,
        COALESCE(SUM(b.tax), 0.00) as total_tax,
        COALESCE(SUM(b.grand_total), 0.00) as total_sales
      FROM bills b
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED';
    `;
    const { rows } = await query(text, [startDate, endDate]);
    return rows[0];
  }

  static async getPaymentSplits(startDate: string, endDate: string) {
    const text = `
      SELECT
        p.payment_method,
        COALESCE(SUM(p.amount), 0.00) as total_amount
      FROM payments p
      JOIN bills b ON p.bill_id = b.id
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED'
        AND p.status = 'COMPLETED'
      GROUP BY p.payment_method;
    `;
    const { rows } = await query(text, [startDate, endDate]);
    return rows;
  }

  static async getExpensesSummary(startDate: string, endDate: string) {
    const text = `
      SELECT COALESCE(SUM(amount), 0.00) as total_expenses
      FROM expenses
      WHERE business_date >= $1
        AND business_date <= $2
        AND is_voided = FALSE;
    `;
    const { rows } = await query(text, [startDate, endDate]);
    return rows[0].total_expenses;
  }

  static async getExpensesByCategory(startDate: string, endDate: string) {
    const text = `
      SELECT category, COALESCE(SUM(amount), 0.00) as total_amount
      FROM expenses
      WHERE business_date >= $1
        AND business_date <= $2
        AND is_voided = FALSE
      GROUP BY category;
    `;
    const { rows } = await query(text, [startDate, endDate]);
    return rows;
  }

  static async getItemSalesBreakdown(startDate: string, endDate: string) {
    const text = `
      SELECT
        l.item_name,
        l.category_name,
        SUM(l.quantity) as total_quantity,
        SUM(l.total) as total_revenue
      FROM bill_lines l
      JOIN bills b ON l.bill_id = b.id
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED'
      GROUP BY l.item_name, l.category_name
      ORDER BY total_revenue DESC;
    `;
    const { rows } = await query(text, [startDate, endDate]);
    return rows;
  }

  static async getCategorySalesBreakdown(startDate: string, endDate: string) {
    const text = `
      SELECT
        l.category_name,
        SUM(l.quantity) as total_quantity,
        SUM(l.total) as total_revenue
      FROM bill_lines l
      JOIN bills b ON l.bill_id = b.id
      WHERE b.business_date >= $1
        AND b.business_date <= $2
        AND b.status = 'COMPLETED'
      GROUP BY l.category_name
      ORDER BY total_revenue DESC;
    `;
    const { rows } = await query(text, [startDate, endDate]);
    return rows;
  }
}
