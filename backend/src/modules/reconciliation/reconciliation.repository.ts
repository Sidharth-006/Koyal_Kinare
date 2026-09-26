import { query } from '@/shared/database/client';

export interface CashOpeningRecord {
  id: string;
  business_date: string;
  opening_cash: string;
  set_by: string;
  set_at: string;
  created_at: string;
}

export interface DailyClosingRecord {
  id: string;
  business_date: string;
  opening_cash: string;
  cash_sales: string;
  cash_expenses: string;
  expected_closing_cash: string;
  actual_cash: string;
  cash_difference: string;
  cash_status: 'MATCHED' | 'SHORTAGE' | 'EXCESS';
  upi_sales: string;
  upi_settlement: string;
  upi_difference: string;
  upi_status: 'MATCHED' | 'MISMATCHED';
  card_sales: string;
  card_settlement: string;
  card_difference: string;
  card_status: 'MATCHED' | 'MISMATCHED';
  status: 'OPEN' | 'CLOSED' | 'MISMATCHED';
  notes?: string | null;
  closed_by: string;
  closed_at: string;
  created_at: string;
}

export interface SettlementRecord {
  id: string;
  business_date: string;
  method: 'UPI' | 'CARD';
  expected_amount: string;
  settlement_amount: string;
  difference: string;
  status: 'MATCHED' | 'MISMATCHED';
  notes?: string | null;
  settled_by: string;
  settled_at: string;
  created_at: string;
}

export class ReconciliationRepository {
  static async setOpeningCash(businessDate: string, openingCash: string, adminId: string): Promise<CashOpeningRecord> {
    const text = `
      INSERT INTO cash_openings (business_date, opening_cash, set_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (business_date)
      DO UPDATE SET opening_cash = $2, set_by = $3, set_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const { rows } = await query(text, [businessDate, openingCash, adminId]);
    return rows[0];
  }

  static async getOpeningCash(businessDate: string): Promise<CashOpeningRecord | null> {
    const { rows } = await query('SELECT * FROM cash_openings WHERE business_date = $1', [businessDate]);
    return rows[0] || null;
  }

  static async getCompletedPaymentsByMethod(businessDate: string, method: 'CASH' | 'UPI' | 'CARD'): Promise<string> {
    const text = `
      SELECT COALESCE(SUM(p.amount), 0.00) as total
      FROM payments p
      JOIN bills b ON p.bill_id = b.id
      WHERE b.business_date = $1
        AND b.status = 'COMPLETED'
        AND p.status = 'COMPLETED'
        AND p.payment_method = $2;
    `;
    const { rows } = await query(text, [businessDate, method]);
    return rows[0].total;
  }

  static async getActiveExpensesByMethod(businessDate: string, method: 'CASH' | 'UPI' | 'CARD'): Promise<string> {
    const text = `
      SELECT COALESCE(SUM(amount), 0.00) as total
      FROM expenses
      WHERE business_date = $1
        AND is_voided = FALSE
        AND payment_method = $2;
    `;
    const { rows } = await query(text, [businessDate, method]);
    return rows[0].total;
  }

  static async getReceivedPurchasesByMethod(businessDate: string, method: 'CASH' | 'UPI' | 'CARD' | 'CREDIT'): Promise<string> {
    const text = `
      SELECT COALESCE(SUM(grand_total), 0.00) as total
      FROM purchases
      WHERE purchase_date = $1
        AND status = 'RECEIVED'
        AND payment_method = $2;
    `;
    const { rows } = await query(text, [businessDate, method]);
    return rows[0].total;
  }

  static async recordSettlement(params: {
    businessDate: string;
    method: 'UPI' | 'CARD';
    expectedAmount: string;
    settlementAmount: string;
    difference: string;
    status: 'MATCHED' | 'MISMATCHED';
    notes?: string;
    settledBy: string;
  }): Promise<SettlementRecord> {
    const text = `
      INSERT INTO settlements (business_date, method, expected_amount, settlement_amount, difference, status, notes, settled_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (business_date, method)
      DO UPDATE SET settlement_amount = $4, difference = $5, status = $6, notes = $7, settled_by = $8, settled_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const values = [
      params.businessDate,
      params.method,
      params.expectedAmount,
      params.settlementAmount,
      params.difference,
      params.status,
      params.notes || '',
      params.settledBy
    ];
    const { rows } = await query(text, values);
    return rows[0];
  }

  static async getSettlement(businessDate: string, method: 'UPI' | 'CARD'): Promise<SettlementRecord | null> {
    const { rows } = await query('SELECT * FROM settlements WHERE business_date = $1 AND method = $2', [businessDate, method]);
    return rows[0] || null;
  }

  static async saveDailyClosing(params: {
    businessDate: string;
    openingCash: string;
    cashSales: string;
    cashExpenses: string;
    expectedClosingCash: string;
    actualCash: string;
    cashDifference: string;
    cashStatus: 'MATCHED' | 'SHORTAGE' | 'EXCESS';
    upiSales: string;
    upiSettlement: string;
    upiDifference: string;
    upiStatus: 'MATCHED' | 'MISMATCHED';
    cardSales: string;
    cardSettlement: string;
    cardDifference: string;
    cardStatus: 'MATCHED' | 'MISMATCHED';
    status: 'OPEN' | 'CLOSED' | 'MISMATCHED';
    notes?: string;
    closedBy: string;
  }): Promise<DailyClosingRecord> {
    const text = `
      INSERT INTO daily_closings (
        business_date, opening_cash, cash_sales, cash_expenses, expected_closing_cash, actual_cash, cash_difference, cash_status,
        upi_sales, upi_settlement, upi_difference, upi_status,
        card_sales, card_settlement, card_difference, card_status,
        status, notes, closed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (business_date)
      DO UPDATE SET
        opening_cash = $2, cash_sales = $3, cash_expenses = $4, expected_closing_cash = $5, actual_cash = $6, cash_difference = $7, cash_status = $8,
        upi_sales = $9, upi_settlement = $10, upi_difference = $11, upi_status = $12,
        card_sales = $13, card_settlement = $14, card_difference = $15, card_status = $16,
        status = $17, notes = $18, closed_by = $19, closed_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const values = [
      params.businessDate, params.openingCash, params.cashSales, params.cashExpenses, params.expectedClosingCash,
      params.actualCash, params.cashDifference, params.cashStatus,
      params.upiSales, params.upiSettlement, params.upiDifference, params.upiStatus,
      params.cardSales, params.cardSettlement, params.cardDifference, params.cardStatus,
      params.status, params.notes || '', params.closedBy
    ];
    const { rows } = await query(text, values);
    return rows[0];
  }

  static async getDailyClosing(businessDate: string): Promise<DailyClosingRecord | null> {
    const { rows } = await query('SELECT * FROM daily_closings WHERE business_date = $1', [businessDate]);
    return rows[0] || null;
  }
}
