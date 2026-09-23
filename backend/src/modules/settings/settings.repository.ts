import { query } from '@/shared/database/client';

export interface BusinessSettingsRecord {
  id: string;
  cafe_name: string;
  address: string;
  contact_phone: string;
  currency: string;
  receipt_header: string;
  receipt_footer: string;
  updated_at: string;
  updated_by?: string | null;
}

export interface TargetSettingsRecord {
  id: string;
  daily_sales_target: string;
  monthly_sales_target: string;
  updated_at: string;
  updated_by?: string | null;
}

export interface TaxSettingsRecord {
  id: string;
  enabled: boolean;
  label: string;
  rate: string;
  is_inclusive: boolean;
  updated_at: string;
  updated_by?: string | null;
}

export class SettingsRepository {
  static async getBusinessSettings(): Promise<BusinessSettingsRecord> {
    const { rows } = await query('SELECT * FROM business_settings LIMIT 1');
    if (rows[0]) return rows[0];

    const { rows: inserted } = await query(`
      INSERT INTO business_settings (cafe_name, address, contact_phone, currency, receipt_header, receipt_footer)
      VALUES ('Koyal Kinare Cafe', 'Main Beach Road, Anjuna, Goa', '+91 98765 43210', 'INR', 'Welcome to Koyal Kinare Cafe!', 'Thank you for visiting!')
      RETURNING *;
    `);
    return inserted[0];
  }

  static async updateBusinessSettings(params: Partial<BusinessSettingsRecord>, adminId: string): Promise<BusinessSettingsRecord> {
    const current = await this.getBusinessSettings();
    const { rows } = await query(
      `UPDATE business_settings
       SET cafe_name = COALESCE($1, cafe_name),
           address = COALESCE($2, address),
           contact_phone = COALESCE($3, contact_phone),
           currency = COALESCE($4, currency),
           receipt_header = COALESCE($5, receipt_header),
           receipt_footer = COALESCE($6, receipt_footer),
           updated_at = CURRENT_TIMESTAMP,
           updated_by = $7
       WHERE id = $8
       RETURNING *;`,
      [params.cafe_name, params.address, params.contact_phone, params.currency, params.receipt_header, params.receipt_footer, adminId, current.id]
    );
    return rows[0];
  }

  static async getTargetSettings(): Promise<TargetSettingsRecord> {
    const { rows } = await query('SELECT * FROM target_settings LIMIT 1');
    if (rows[0]) return rows[0];

    const { rows: inserted } = await query(`
      INSERT INTO target_settings (daily_sales_target, monthly_sales_target)
      VALUES (5000.00, 150000.00)
      RETURNING *;
    `);
    return inserted[0];
  }

  static async updateTargetSettings(daily: string | number, monthly: string | number, adminId: string): Promise<TargetSettingsRecord> {
    const current = await this.getTargetSettings();
    const { rows } = await query(
      `UPDATE target_settings
       SET daily_sales_target = $1,
           monthly_sales_target = $2,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = $3
       WHERE id = $4
       RETURNING *;`,
      [daily, monthly, adminId, current.id]
    );
    return rows[0];
  }

  static async getTaxSettings(): Promise<TaxSettingsRecord> {
    const { rows } = await query('SELECT * FROM tax_settings LIMIT 1');
    if (rows[0]) return rows[0];

    const { rows: inserted } = await query(`
      INSERT INTO tax_settings (enabled, label, rate, is_inclusive)
      VALUES (TRUE, 'GST', 5.00, FALSE)
      RETURNING *;
    `);
    return inserted[0];
  }

  static async updateTaxSettings(enabled: boolean, label: string, rate: string | number, isInclusive: boolean, adminId: string): Promise<TaxSettingsRecord> {
    const current = await this.getTaxSettings();
    const { rows } = await query(
      `UPDATE tax_settings
       SET enabled = $1,
           label = $2,
           rate = $3,
           is_inclusive = $4,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = $5
       WHERE id = $6
       RETURNING *;`,
      [enabled, label, rate, isInclusive, adminId, current.id]
    );
    return rows[0];
  }
}
