import { query } from '@/shared/database/client';
import { PoolClient } from 'pg';
import {
  Purchase,
  PurchaseLine,
  PurchaseReversal,
  PurchaseStatus,
  PurchasePaymentMethod
} from './purchases.types';

export interface PurchaseListFilters {
  startDate?: string;
  endDate?: string;
  supplierId?: string;
  inventoryItemId?: string;
  paymentMethod?: PurchasePaymentMethod;
  status?: PurchaseStatus;
  page?: number | string;
  pageSize?: number | string;
}

export interface PurchaseListResult {
  items: Purchase[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function formatPurchaseLine(row: any): PurchaseLine {
  return {
    id: row.id,
    purchase_id: row.purchase_id,
    purchaseId: row.purchase_id,
    inventory_item_id: row.inventory_item_id,
    inventoryItemId: row.inventory_item_id,
    item_name: row.item_name,
    itemName: row.item_name,
    unit: row.unit,
    quantity: String(row.quantity),
    unit_rate: String(row.unit_rate),
    unitRate: String(row.unit_rate),
    line_discount: String(row.line_discount),
    lineDiscount: String(row.line_discount),
    tax_rate: String(row.tax_rate),
    taxRate: String(row.tax_rate),
    line_total: String(row.line_total),
    lineTotal: String(row.line_total),
    created_at: row.created_at,
    createdAt: row.created_at
  };
}

export function formatPurchaseReversal(row: any): PurchaseReversal {
  return {
    id: row.id,
    purchase_id: row.purchase_id,
    purchaseId: row.purchase_id,
    reason: row.reason,
    reversed_by: row.reversed_by,
    reversedBy: row.reversed_by,
    reversed_at: row.reversed_at,
    reversedAt: row.reversed_at
  };
}

export function formatPurchase(row: any, lines?: PurchaseLine[], reversal?: PurchaseReversal | null): Purchase {
  return {
    id: row.id,
    purchase_number: row.purchase_number,
    purchaseNumber: row.purchase_number,
    supplier_id: row.supplier_id || null,
    supplierId: row.supplier_id || null,
    supplier_name: row.supplier_name,
    supplierName: row.supplier_name,
    invoice_number: row.invoice_number || null,
    invoiceNumber: row.invoice_number || null,
    purchase_date: typeof row.purchase_date === 'string' ? row.purchase_date.substring(0, 10) : new Date(row.purchase_date).toISOString().substring(0, 10),
    purchaseDate: typeof row.purchase_date === 'string' ? row.purchase_date.substring(0, 10) : new Date(row.purchase_date).toISOString().substring(0, 10),
    payment_method: row.payment_method,
    paymentMethod: row.payment_method,
    discount: String(row.discount),
    tax_amount: String(row.tax_amount),
    taxAmount: String(row.tax_amount),
    grand_total: String(row.grand_total),
    grandTotal: String(row.grand_total),
    status: row.status,
    received_at: row.received_at || null,
    receivedAt: row.received_at || null,
    attachment_id: row.attachment_id || null,
    attachmentId: row.attachment_id || null,
    note: row.note || null,
    created_by: row.created_by,
    createdBy: row.created_by,
    created_at: row.created_at,
    createdAt: row.created_at,
    updated_at: row.updated_at,
    updatedAt: row.updated_at,
    lines: lines || [],
    reversal: reversal !== undefined ? reversal : null
  };
}

export class PurchaseRepository {
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

  /**
   * Generates next purchase number: KP-YYYYMMDD-XXXX
   * Uses sequence purchase_number_seq inside database.
   */
  static async generateNextPurchaseNumber(purchaseDateStr: string, client?: PoolClient): Promise<string> {
    const db = this.getExecutor(client);
    const cleanDate = purchaseDateStr.replace(/-/g, '');
    const { rows } = await db.query("SELECT nextval('purchase_number_seq') as seq");
    const seqNum = String(rows[0].seq).padStart(4, '0');
    return `KP-${cleanDate}-${seqNum}`;
  }

  /**
   * Insert header row
   */
  static async createPurchase(
    params: {
      purchaseNumber: string;
      supplierId: string | null;
      supplierName: string;
      invoiceNumber?: string | null;
      purchaseDate: string;
      paymentMethod: PurchasePaymentMethod;
      discount: string;
      taxAmount: string;
      grandTotal: string;
      note?: string | null;
      createdBy: string;
    },
    client?: PoolClient
  ): Promise<Purchase> {
    const db = this.getExecutor(client);
    const sql = `
      INSERT INTO purchases (
        purchase_number, supplier_id, supplier_name, invoice_number,
        purchase_date, payment_method, discount, tax_amount, grand_total,
        status, note, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'DRAFT', $10, $11)
      RETURNING *;
    `;
    const values = [
      params.purchaseNumber,
      params.supplierId,
      params.supplierName,
      params.invoiceNumber || null,
      params.purchaseDate,
      params.paymentMethod,
      params.discount,
      params.taxAmount,
      params.grandTotal,
      params.note || null,
      params.createdBy
    ];

    const { rows } = await db.query(sql, values);
    return formatPurchase(rows[0]);
  }

  /**
   * Insert lines for a purchase
   */
  static async createPurchaseLines(
    purchaseId: string,
    lines: Array<{
      inventoryItemId: string;
      itemName: string;
      unit: string;
      quantity: string;
      unitRate: string;
      lineDiscount: string;
      taxRate: string;
      lineTotal: string;
    }>,
    client?: PoolClient
  ): Promise<PurchaseLine[]> {
    if (lines.length === 0) return [];
    const db = this.getExecutor(client);

    const createdLines: PurchaseLine[] = [];
    for (const line of lines) {
      const sql = `
        INSERT INTO purchase_lines (
          purchase_id, inventory_item_id, item_name, unit,
          quantity, unit_rate, line_discount, tax_rate, line_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;
      const values = [
        purchaseId,
        line.inventoryItemId,
        line.itemName,
        line.unit,
        line.quantity,
        line.unitRate,
        line.lineDiscount,
        line.taxRate,
        line.lineTotal
      ];
      const { rows } = await db.query(sql, values);
      createdLines.push(formatPurchaseLine(rows[0]));
    }

    return createdLines;
  }

  /**
   * Find purchase by ID (without locking)
   */
  static async findById(id: string, client?: PoolClient): Promise<Purchase | null> {
    const db = this.getExecutor(client);
    const { rows } = await db.query(`SELECT * FROM purchases WHERE id = $1`, [id]);
    return rows[0] ? formatPurchase(rows[0]) : null;
  }

  /**
   * Lock purchase row using SELECT ... FOR UPDATE
   */
  static async findByIdForUpdate(id: string, client: PoolClient): Promise<Purchase | null> {
    const { rows } = await client.query(`SELECT * FROM purchases WHERE id = $1 FOR UPDATE`, [id]);
    return rows[0] ? formatPurchase(rows[0]) : null;
  }

  /**
   * Find purchase lines by purchase ID
   */
  static async findLinesByPurchaseId(purchaseId: string, client?: PoolClient): Promise<PurchaseLine[]> {
    const db = this.getExecutor(client);
    const { rows } = await db.query(
      `SELECT * FROM purchase_lines WHERE purchase_id = $1 ORDER BY created_at ASC`,
      [purchaseId]
    );
    return rows.map(formatPurchaseLine);
  }

  /**
   * Find purchase reversal by purchase ID
   */
  static async findReversalByPurchaseId(purchaseId: string, client?: PoolClient): Promise<PurchaseReversal | null> {
    const db = this.getExecutor(client);
    const { rows } = await db.query(
      `SELECT * FROM purchase_reversals WHERE purchase_id = $1`,
      [purchaseId]
    );
    return rows[0] ? formatPurchaseReversal(rows[0]) : null;
  }

  /**
   * Find full purchase with lines and reversal (if any)
   */
  static async findByIdWithDetails(id: string, client?: PoolClient): Promise<Purchase | null> {
    const purchase = await this.findById(id, client);
    if (!purchase) return null;

    const [lines, reversal] = await Promise.all([
      this.findLinesByPurchaseId(id, client),
      this.findReversalByPurchaseId(id, client)
    ]);

    return {
      ...purchase,
      lines,
      reversal
    };
  }

  /**
   * Update draft purchase header
   */
  static async updatePurchaseDraft(
    id: string,
    params: {
      supplierId: string | null;
      supplierName: string;
      invoiceNumber?: string | null;
      purchaseDate?: string;
      paymentMethod?: PurchasePaymentMethod;
      discount: string;
      taxAmount: string;
      grandTotal: string;
      note?: string | null;
    },
    client: PoolClient
  ): Promise<Purchase> {
    const sql = `
      UPDATE purchases
      SET supplier_id = $2,
          supplier_name = $3,
          invoice_number = $4,
          purchase_date = COALESCE($5, purchase_date),
          payment_method = COALESCE($6, payment_method),
          discount = $7,
          tax_amount = $8,
          grand_total = $9,
          note = $10,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const values = [
      id,
      params.supplierId,
      params.supplierName,
      params.invoiceNumber || null,
      params.purchaseDate || null,
      params.paymentMethod || null,
      params.discount,
      params.taxAmount,
      params.grandTotal,
      params.note || null
    ];
    const { rows } = await client.query(sql, values);
    return formatPurchase(rows[0]);
  }

  /**
   * Delete existing lines of a purchase (used during draft update)
   */
  static async deleteLinesByPurchaseId(purchaseId: string, client: PoolClient): Promise<void> {
    await client.query(`DELETE FROM purchase_lines WHERE purchase_id = $1`, [purchaseId]);
  }

  /**
   * Update status to RECEIVED
   */
  static async markReceived(purchaseId: string, client: PoolClient): Promise<Purchase> {
    const sql = `
      UPDATE purchases
      SET status = 'RECEIVED',
          received_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await client.query(sql, [purchaseId]);
    return formatPurchase(rows[0]);
  }

  /**
   * Create reversal record and update purchase status to REVERSED
   */
  static async createReversal(
    params: {
      purchaseId: string;
      reason: string;
      reversedBy: string;
    },
    client: PoolClient
  ): Promise<PurchaseReversal> {
    const insertReversalSql = `
      INSERT INTO purchase_reversals (purchase_id, reason, reversed_by)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows: reversalRows } = await client.query(insertReversalSql, [
      params.purchaseId,
      params.reason,
      params.reversedBy
    ]);

    const updatePurchaseSql = `
      UPDATE purchases
      SET status = 'REVERSED',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `;
    await client.query(updatePurchaseSql, [params.purchaseId]);

    return formatPurchaseReversal(reversalRows[0]);
  }

  /**
   * Filtered & paginated list of purchases
   */
  static async listPurchases(filters: PurchaseListFilters): Promise<PurchaseListResult> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (filters.startDate) {
      conditions.push(`p.purchase_date >= $${idx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`p.purchase_date <= $${idx++}`);
      params.push(filters.endDate);
    }
    if (filters.supplierId) {
      conditions.push(`p.supplier_id = $${idx++}`);
      params.push(filters.supplierId);
    }
    if (filters.status) {
      conditions.push(`p.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.paymentMethod) {
      conditions.push(`p.payment_method = $${idx++}`);
      params.push(filters.paymentMethod);
    }
    if (filters.inventoryItemId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM purchase_lines pl
        WHERE pl.purchase_id = p.id AND pl.inventory_item_id = $${idx++}
      )`);
      params.push(filters.inventoryItemId);
    }

    const whereClause = conditions.join(' AND ');

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM purchases p WHERE ${whereClause}`;
    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize) || 1;

    // List query
    const listSql = `
      SELECT p.*
      FROM purchases p
      WHERE ${whereClause}
      ORDER BY p.purchase_date DESC, p.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    const listParams = [...params, pageSize, offset];
    const { rows } = await query(listSql, listParams);

    const items = rows.map((r) => formatPurchase(r));

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

  /**
   * Insert attachment metadata into attachments table
   */
  static async createAttachment(
    params: {
      storageKey: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      uploadedBy: string;
    },
    client?: PoolClient
  ): Promise<{ id: string; storage_key: string; file_name: string; mime_type: string; file_size: number; uploaded_by: string; created_at: string }> {
    const db = this.getExecutor(client);
    const sql = `
      INSERT INTO attachments (storage_key, file_name, mime_type, file_size, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [params.storageKey, params.fileName, params.mimeType, params.fileSize, params.uploadedBy]);
    return rows[0];
  }

  /**
   * Find attachment metadata by id
   */
  static async findAttachmentById(
    id: string,
    client?: PoolClient
  ): Promise<{ id: string; storage_key: string; file_name: string; mime_type: string; file_size: number; uploaded_by: string; created_at: string } | null> {
    const db = this.getExecutor(client);
    const { rows } = await db.query('SELECT * FROM attachments WHERE id = $1', [id]);
    return rows[0] || null;
  }

  /**
   * Update purchases.attachment_id
   */
  static async updateAttachmentId(purchaseId: string, attachmentId: string, client?: PoolClient): Promise<Purchase> {
    const db = this.getExecutor(client);
    const sql = `
      UPDATE purchases
      SET attachment_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [attachmentId, purchaseId]);
    return formatPurchase(rows[0]);
  }
}

