import { query } from '@/shared/database/client';
import { PoolClient } from 'pg';

export interface BillRecord {
  id: string;
  bill_number: string;
  business_date: string;
  order_type: 'DINE_IN' | 'TAKEAWAY';
  table_id?: string | null;
  status: 'DRAFT' | 'COMPLETED' | 'VOIDED';
  subtotal: string;
  discount: string;
  tax: string;
  grand_total: string;
  completed_at: string;
  created_at: string;
  created_by: string;
  lines?: BillLineRecord[];
  payments?: PaymentRecord[];
  void_record?: BillVoidRecord | null;
}

export interface BillLineRecord {
  id: string;
  bill_id: string;
  menu_item_id?: string | null;
  item_name: string;
  category_name: string;
  unit_price: string;
  quantity: number;
  line_discount: string;
  tax_rate: string;
  subtotal: string;
  tax: string;
  total: string;
}

export interface PaymentRecord {
  id: string;
  bill_id: string;
  payment_method: 'CASH' | 'UPI' | 'CARD';
  amount: string;
  status: 'COMPLETED' | 'VOIDED';
  processed_at: string;
  created_at: string;
}

export interface BillVoidRecord {
  id: string;
  bill_id: string;
  void_reason: string;
  voided_by: string;
  voided_at: string;
  created_at: string;
}

export class BillingRepository {
  static async generateNextBillNumber(client: PoolClient, businessDateStr: string): Promise<string> {
    const cleanDate = businessDateStr.replace(/-/g, '');
    const { rows } = await client.query("SELECT nextval('bill_number_seq') as seq");
    const seqNum = String(rows[0].seq).padStart(4, '0');
    return `KB-${cleanDate}-${seqNum}`;
  }

  static async createBill(
    params: {
      billNumber: string;
      businessDate: string;
      orderType: 'DINE_IN' | 'TAKEAWAY';
      tableId?: string | null;
      subtotal: string;
      discount: string;
      tax: string;
      grandTotal: string;
      createdBy: string;
    },
    client: PoolClient
  ): Promise<BillRecord> {
    const text = `
      INSERT INTO bills (bill_number, business_date, order_type, table_id, status, subtotal, discount, tax, grand_total, created_by)
      VALUES ($1, $2, $3, $4, 'COMPLETED', $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      params.billNumber,
      params.businessDate,
      params.orderType,
      params.tableId || null,
      params.subtotal,
      params.discount,
      params.tax,
      params.grandTotal,
      params.createdBy
    ];
    const { rows } = await client.query(text, values);
    return rows[0];
  }

  static async createBillLine(
    params: {
      billId: string;
      menuItemId?: string | null;
      itemName: string;
      categoryName: string;
      unitPrice: string;
      quantity: number;
      lineDiscount: string;
      taxRate: string;
      subtotal: string;
      tax: string;
      total: string;
    },
    client: PoolClient
  ): Promise<BillLineRecord> {
    const text = `
      INSERT INTO bill_lines (bill_id, menu_item_id, item_name, category_name, unit_price, quantity, line_discount, tax_rate, subtotal, tax, total)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      params.billId,
      params.menuItemId || null,
      params.itemName,
      params.categoryName,
      params.unitPrice,
      params.quantity,
      params.lineDiscount,
      params.taxRate,
      params.subtotal,
      params.tax,
      params.total
    ];
    const { rows } = await client.query(text, values);
    return rows[0];
  }

  static async createPayment(
    params: {
      billId: string;
      paymentMethod: 'CASH' | 'UPI' | 'CARD';
      amount: string;
    },
    client: PoolClient
  ): Promise<PaymentRecord> {
    const text = `
      INSERT INTO payments (bill_id, payment_method, amount, status)
      VALUES ($1, $2, $3, 'COMPLETED')
      RETURNING *;
    `;
    const { rows } = await client.query(text, [params.billId, params.paymentMethod, params.amount]);
    return rows[0];
  }

  static async findBillById(id: string): Promise<BillRecord | null> {
    const { rows } = await query('SELECT * FROM bills WHERE id = $1', [id]);
    if (!rows[0]) return null;

    const bill = rows[0];
    const { rows: lines } = await query('SELECT * FROM bill_lines WHERE bill_id = $1', [id]);
    const { rows: payments } = await query('SELECT * FROM payments WHERE bill_id = $1', [id]);
    const { rows: voidRecords } = await query('SELECT * FROM bill_voids WHERE bill_id = $1', [id]);

    bill.lines = lines;
    bill.payments = payments;
    bill.void_record = voidRecords[0] || null;
    return bill;
  }

  static async createBillVoid(
    params: { billId: string; voidReason: string; voidedBy: string },
    client: PoolClient
  ): Promise<BillVoidRecord> {
    await client.query("UPDATE bills SET status = 'VOIDED' WHERE id = $1", [params.billId]);

    const { rows } = await client.query(
      'INSERT INTO bill_voids (bill_id, void_reason, voided_by) VALUES ($1, $2, $3) RETURNING *;',
      [params.billId, params.voidReason, params.voidedBy]
    );
    return rows[0];
  }

  static async listBills(params: { startDate?: string; endDate?: string; status?: string; limit?: number; offset?: number }): Promise<BillRecord[]> {
    let text = 'SELECT * FROM bills WHERE 1=1';
    const values: any[] = [];

    if (params.startDate) {
      values.push(params.startDate);
      text += ` AND business_date >= $${values.length}`;
    }
    if (params.endDate) {
      values.push(params.endDate);
      text += ` AND business_date <= $${values.length}`;
    }
    if (params.status) {
      values.push(params.status);
      text += ` AND status = $${values.length}`;
    }

    text += ' ORDER BY created_at DESC';

    const limit = params.limit || 100;
    const offset = params.offset || 0;
    values.push(limit, offset);
    text += ` LIMIT $${values.length - 1} OFFSET $${values.length}`;

    const { rows } = await query(text, values);
    return rows;
  }
}
