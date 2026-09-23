import { query } from '@/shared/database/client';

export interface ExpenseRecord {
  id: string;
  business_date: string;
  category: 'RAW_MATERIALS' | 'LPG' | 'ELECTRICITY' | 'SALARY' | 'PACKAGING' | 'MAINTENANCE' | 'MISCELLANEOUS';
  amount: string;
  payment_method: 'CASH' | 'UPI' | 'CARD';
  description: string;
  attachment_id?: string | null;
  is_voided: boolean;
  void_reason?: string | null;
  voided_by?: string | null;
  voided_at?: string | null;
  created_by: string;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  attachment?: AttachmentRecord | null;
}

export interface AttachmentRecord {
  id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export class ExpenseRepository {
  static async createAttachment(params: {
    storageKey: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    uploadedBy: string;
  }): Promise<AttachmentRecord> {
    const text = `
      INSERT INTO attachments (storage_key, file_name, mime_type, file_size, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const { rows } = await query(text, [params.storageKey, params.fileName, params.mimeType, params.fileSize, params.uploadedBy]);
    return rows[0];
  }

  static async findAttachmentById(id: string): Promise<AttachmentRecord | null> {
    const { rows } = await query('SELECT * FROM attachments WHERE id = $1', [id]);
    return rows[0] || null;
  }

  static async createExpense(params: {
    businessDate: string;
    category: string;
    amount: string;
    paymentMethod: 'CASH' | 'UPI' | 'CARD';
    description: string;
    attachmentId?: string | null;
    createdBy: string;
  }): Promise<ExpenseRecord> {
    const text = `
      INSERT INTO expenses (business_date, category, amount, payment_method, description, attachment_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      params.businessDate,
      params.category,
      params.amount,
      params.paymentMethod,
      params.description,
      params.attachmentId || null,
      params.createdBy
    ];
    const { rows } = await query(text, values);
    return rows[0];
  }

  static async findExpenseById(id: string): Promise<ExpenseRecord | null> {
    const { rows } = await query('SELECT e.*, a.storage_key, a.file_name, a.mime_type, a.file_size FROM expenses e LEFT JOIN attachments a ON e.attachment_id = a.id WHERE e.id = $1', [id]);
    if (!rows[0]) return null;

    const row = rows[0];
    return {
      ...row,
      attachment: row.attachment_id ? {
        id: row.attachment_id,
        storage_key: row.storage_key,
        file_name: row.file_name,
        mime_type: row.mime_type,
        file_size: row.file_size,
        uploaded_by: row.created_by,
        created_at: row.created_at
      } : null
    };
  }

  static async voidExpense(id: string, voidReason: string, adminId: string): Promise<ExpenseRecord> {
    const text = `
      UPDATE expenses
      SET is_voided = TRUE,
          void_reason = $1,
          voided_by = $2,
          voided_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const { rows } = await query(text, [voidReason, adminId, id]);
    return rows[0];
  }

  static async listExpenses(params: { startDate?: string; endDate?: string; category?: string; paymentMethod?: string; includeVoided?: boolean }): Promise<ExpenseRecord[]> {
    let text = 'SELECT e.*, a.file_name FROM expenses e LEFT JOIN attachments a ON e.attachment_id = a.id WHERE 1=1';
    const values: any[] = [];

    if (!params.includeVoided) {
      text += ' AND e.is_voided = FALSE';
    }
    if (params.startDate) {
      values.push(params.startDate);
      text += ` AND e.business_date >= $${values.length}`;
    }
    if (params.endDate) {
      values.push(params.endDate);
      text += ` AND e.business_date <= $${values.length}`;
    }
    if (params.category) {
      values.push(params.category);
      text += ` AND e.category = $${values.length}`;
    }
    if (params.paymentMethod) {
      values.push(params.paymentMethod);
      text += ` AND e.payment_method = $${values.length}`;
    }

    text += ' ORDER BY e.business_date DESC, e.created_at DESC;';

    const { rows } = await query(text, values);
    return rows;
  }
}
