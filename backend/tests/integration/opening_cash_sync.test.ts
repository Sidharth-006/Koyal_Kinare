import { describe, it, expect, beforeEach } from 'vitest';
import { ReconciliationService } from '@/modules/reconciliation/reconciliation.service';
import { ReconciliationRepository } from '@/modules/reconciliation/reconciliation.repository';
import { query } from '@/shared/database/client';

describe('Daily Closing / Opening Cash Synchronization Integration Tests', () => {
  const testDate = '2026-09-30';
  const otherDate = '2026-10-01';
  let adminId: string;

  beforeEach(async () => {
    // Find or create test admin
    const { rows } = await query('SELECT id FROM admins LIMIT 1');
    adminId = rows[0].id;

    // Clean up test dates
    await query('DELETE FROM daily_closings WHERE business_date IN ($1, $2)', [testDate, otherDate]);
    await query('DELETE FROM cash_openings WHERE business_date IN ($1, $2)', [testDate, otherDate]);
    await query('DELETE FROM expenses WHERE business_date IN ($1, $2)', [testDate, otherDate]);
    await query('DELETE FROM bills WHERE business_date IN ($1, $2)', [testDate, otherDate]);
  });

  it('should return opening: null, openingCash: 0.00 and expectedCash: 0.00 when no opening float is set', async () => {
    const preview = await ReconciliationService.getReconciliationPreview(testDate);
    expect(preview.opening).toBeNull();
    expect(preview.openingCash).toBe('0.00');
    expect(preview.expectedCash).toBe('0.00');
    expect(preview.expectedClosingCash).toBe('0.00');
  });

  it('should save opening cash float = 1000 and return expectedCash = 1000 with 0 sales/expenses', async () => {
    // 1. Set opening cash
    const opening = await ReconciliationService.setOpeningCash(testDate, 1000, adminId);
    expect(opening.opening_cash).toBe('1000.00');

    // 2. Preview
    const preview = await ReconciliationService.getReconciliationPreview(testDate);
    expect(preview.opening).not.toBeNull();
    expect(preview.opening?.opening_cash).toBe('1000.00');
    expect(preview.openingCash).toBe('1000.00');
    expect(preview.expectedCash).toBe('1000.00');
    expect(preview.expectedClosingCash).toBe('1000.00');
  });

  it('should calculate Expected Cash = Opening Cash (1000) + Cash Sales (500) = 1500', async () => {
    await ReconciliationService.setOpeningCash(testDate, 1000, adminId);

    // Insert mock completed cash payment for testDate
    const billRes = await query(`
      INSERT INTO bills (bill_number, order_type, subtotal, discount, tax, grand_total, status, business_date, created_by)
      VALUES ('KB-TEST-001', 'TAKEAWAY', 500, 0, 0, 500, 'COMPLETED', $1, $2)
      RETURNING id
    `, [testDate, adminId]);

    await query(`
      INSERT INTO payments (bill_id, payment_method, amount, status)
      VALUES ($1, 'CASH', 500, 'COMPLETED')
    `, [billRes.rows[0].id]);

    const preview = await ReconciliationService.getReconciliationPreview(testDate);
    expect(preview.openingCash).toBe('1000.00');
    expect(preview.cashSales).toBe('500.00');
    expect(preview.cashExpenses).toBe('0.00');
    expect(preview.expectedCash).toBe('1500.00');
    expect(preview.expectedClosingCash).toBe('1500.00');
  });

  it('should calculate Expected Cash = Opening (1000) + Sales (500) - Expenses (200) = 1300', async () => {
    await ReconciliationService.setOpeningCash(testDate, 1000, adminId);

    // Mock cash sale of 500
    const billRes = await query(`
      INSERT INTO bills (bill_number, order_type, subtotal, discount, tax, grand_total, status, business_date, created_by)
      VALUES ('KB-TEST-002', 'TAKEAWAY', 500, 0, 0, 500, 'COMPLETED', $1, $2)
      RETURNING id
    `, [testDate, adminId]);

    await query(`
      INSERT INTO payments (bill_id, payment_method, amount, status)
      VALUES ($1, 'CASH', 500, 'COMPLETED')
    `, [billRes.rows[0].id]);

    // Mock cash expense of 200
    await query(`
      INSERT INTO expenses (business_date, category, amount, payment_method, description, is_voided, created_by)
      VALUES ($1, 'RAW_MATERIALS', 200, 'CASH', 'Fresh Vegetables', FALSE, $2)
    `, [testDate, adminId]);

    const preview = await ReconciliationService.getReconciliationPreview(testDate);
    expect(preview.openingCash).toBe('1000.00');
    expect(preview.cashSales).toBe('500.00');
    expect(preview.cashExpenses).toBe('200.00');
    expect(preview.expectedCash).toBe('1300.00');
    expect(preview.expectedClosingCash).toBe('1300.00');
  });

  it('should isolate dates so changing date does not show another date opening cash', async () => {
    // testDate has 1000 opening cash
    await ReconciliationService.setOpeningCash(testDate, 1000, adminId);

    // otherDate has no opening cash
    const otherPreview = await ReconciliationService.getReconciliationPreview(otherDate);
    expect(otherPreview.opening).toBeNull();
    expect(otherPreview.openingCash).toBe('0.00');
    expect(otherPreview.expectedCash).toBe('0.00');

    // testDate still has 1000
    const testPreview = await ReconciliationService.getReconciliationPreview(testDate);
    expect(testPreview.openingCash).toBe('1000.00');
    expect(testPreview.expectedCash).toBe('1000.00');
  });
});
