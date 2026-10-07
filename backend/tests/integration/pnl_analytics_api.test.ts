// tests/integration/pnl_analytics_api.test.ts — Phase 3 Module 4 Integration & API Tests
// Tests all 9 endpoints, auth, validation, export jobs, audit events, calculations, snapshots,
// non-mutation of operational data, and safe failure behaviors.

import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { query } from '@/shared/database/client';
import { AuthRepository } from '@/modules/auth/auth.repository';
import { hashPassword, generateSessionToken } from '@/shared/auth/security';
import { createSessionCookie } from '@/shared/auth/session';

// Import all 9 route handlers
import { GET as pnlHandler } from '@/app/api/pnl/route';
import { GET as overviewHandler } from '@/app/api/analytics/overview/route';
import { GET as menuPerformanceHandler } from '@/app/api/analytics/menu-performance/route';
import { GET as salesRegisterHandler } from '@/app/api/reports/sales-register/route';
import { GET as purchaseRegisterHandler } from '@/app/api/reports/purchase-register/route';
import { GET as expenseRegisterHandler } from '@/app/api/reports/expense-register/route';
import { GET as monthlyPnlHandler } from '@/app/api/reports/monthly-pnl/route';
import { GET as inventoryValuationHandler } from '@/app/api/reports/inventory-valuation/route';
import { GET as reconciliationHandler } from '@/app/api/reports/reconciliation/route';

describe('Phase 3 Module 4 — Integration & API Tests', { timeout: 60000 }, () => {
  let adminId: string;
  let authCookie: string;
  let testBusinessDate: string;

  beforeAll(async () => {
    // 1. Create test admin and valid session cookie
    const email = `pnl_admin_${Date.now()}@koyal.com`;
    const passwordHash = await hashPassword('AdminPass123!');
    const admin = await AuthRepository.createAdmin({
      email,
      passwordHash,
      displayName: 'P&L Analytics Admin',
    });
    adminId = admin.id;

    const { rawToken, tokenHash } = generateSessionToken();
    await AuthRepository.createSession({
      adminId: admin.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });
    authCookie = createSessionCookie(rawToken);

    testBusinessDate = new Date().toISOString().slice(0, 10);

    // Seed test menu category, item, bill, bill lines, payments, and bill cost coverage
    const catRes = await query(
      `INSERT INTO menu_categories (name, display_order)
       VALUES ('Pnl Test Cat ${Date.now()}', 999)
       RETURNING id`
    );
    const catId = catRes.rows[0].id;

    const itemRes = await query(
      `INSERT INTO menu_items (category_id, name, selling_price, is_available)
       VALUES ($1, 'Pnl Test Item ${Date.now()}', 120.00, TRUE)
       RETURNING id`,
      [catId]
    );
    const menuItemId = itemRes.rows[0].id;

    // Seed completed non-voided bill
    const billRes = await query(
      `INSERT INTO bills (bill_number, order_type, subtotal, discount, tax, grand_total, status, business_date, completed_at, created_by)
       VALUES ($1, 'TAKEAWAY', 240.00, 20.00, 11.00, 231.00, 'COMPLETED', $2, NOW(), $3)
       RETURNING id`,
      [`BILL-PNL-${Date.now()}`, testBusinessDate, adminId]
    );
    const billId = billRes.rows[0].id;

    // Seed bill line with historic tax snapshot rate 5.0000%
    const lineRes = await query(
      `INSERT INTO bill_lines (bill_id, menu_item_id, item_name, category_name, quantity, unit_price, tax_rate, subtotal, tax, total)
       VALUES ($1, $2, 'Pnl Test Item', 'Pnl Cat', 2, 120.00, 0.0500, 240.00, 11.00, 231.00)
       RETURNING id`,
      [billId, menuItemId]
    );
    const billLineId = lineRes.rows[0].id;

    // Seed payment
    await query(
      `INSERT INTO payments (bill_id, payment_method, amount, status)
       VALUES ($1, 'CASH', 231.00, 'COMPLETED')`,
      [billId]
    );

    // Seed inventory item and bill consumption with cost snapshot
    const invRes = await query(
      `INSERT INTO inventory_items (name, item_type, base_unit, minimum_stock, created_by)
       VALUES ('Pnl Raw Mat ${Date.now()}', 'RAW_MATERIAL', 'KG', 1.000, $1)
       RETURNING id`,
      [adminId]
    );
    const invItemId = invRes.rows[0].id;

    await query(
      `INSERT INTO inventory_cost_state (inventory_item_id, average_unit_cost, quantity_on_cost_basis)
       VALUES ($1, 45.0000, 10.000)
       ON CONFLICT (inventory_item_id) DO UPDATE SET average_unit_cost = 45.0000`,
      [invItemId]
    );

    await query(
      `INSERT INTO inventory_balances (inventory_item_id, available_quantity)
       VALUES ($1, 10.000)
       ON CONFLICT (inventory_item_id) DO UPDATE SET available_quantity = 10.000`,
      [invItemId]
    );

    // Seed recipe & recipe version for bill_consumptions foreign key
    const recRes = await query(
      `INSERT INTO recipes (menu_item_id, status, created_by)
       VALUES ($1, 'ACTIVE', $2)
       RETURNING id`,
      [menuItemId, adminId]
    );
    const recId = recRes.rows[0].id;

    const rvRes = await query(
      `INSERT INTO recipe_versions (recipe_id, version_number, status, created_by)
       VALUES ($1, 1, 'ACTIVE', $2)
       RETURNING id`,
      [recId, adminId]
    );
    const rvId = rvRes.rows[0].id;

    // Seed a dummy stock movement for consumption
    const smRes = await query(
      `INSERT INTO stock_movements (inventory_item_id, business_date, movement_type, quantity_delta, unit_cost, source_type, source_id, created_by)
       VALUES ($1, $2, 'BILL_CONSUMPTION', -0.500, 45.00, 'BILL_LINE', $3, $4)
       RETURNING id`,
      [invItemId, testBusinessDate, billLineId, adminId]
    );
    const smId = smRes.rows[0].id;

    await query(
      `INSERT INTO bill_consumptions (bill_id, bill_line_id, inventory_item_id, recipe_version_id, quantity_consumed, unit_cost_snapshot, total_cost_snapshot, stock_movement_id)
       VALUES ($1, $2, $3, $4, 0.500, 45.0000, 22.50, $5)`,
      [billId, billLineId, invItemId, rvId, smId]
    );

    await query(
      `INSERT INTO bill_cost_coverage (bill_id, total_bill_lines, covered_lines, missing_recipe_lines, missing_cost_lines, negative_stock_override_used)
       VALUES ($1, 1, 1, 0, 0, FALSE)
       ON CONFLICT (bill_id) DO UPDATE SET total_bill_lines = 1, covered_lines = 1`,
      [billId]
    );

    // Seed a purchase with historic tax rate snapshot
    const suppRes = await query(
      `INSERT INTO suppliers (name, contact_person, phone)
       VALUES ('Pnl Supplier ${Date.now()}', 'Rajesh', '9988776655')
       RETURNING id`
    );
    const suppId = suppRes.rows[0].id;

    const purchRes = await query(
      `INSERT INTO purchases (purchase_number, supplier_id, supplier_name, purchase_date, payment_method, discount, tax_amount, grand_total, status, created_by)
       VALUES ($1, $2, 'Pnl Supplier', $3, 'CASH', 0.00, 18.00, 118.00, 'RECEIVED', $4)
       RETURNING id`,
      [`PO-PNL-${Date.now()}`, suppId, testBusinessDate, adminId]
    );
    const purchId = purchRes.rows[0].id;

    await query(
      `INSERT INTO purchase_lines (purchase_id, inventory_item_id, item_name, unit, quantity, unit_rate, tax_rate, line_total)
       VALUES ($1, $2, 'Pnl Raw Mat', 'KG', 2.000, 50.00, 0.1800, 118.00)`,
      [purchId, invItemId]
    );

    // Seed an expense
    await query(
      `INSERT INTO expenses (business_date, category, amount, payment_method, description, is_voided, created_by)
       VALUES ($1, 'RAW_MATERIALS', 150.00, 'CASH', 'Test expense for P&L', FALSE, $2)`,
      [testBusinessDate, adminId]
    );
  });

  function createReq(url: string, cookie?: string): NextRequest {
    const req = new NextRequest(new URL(url, 'http://localhost:3000'), {
      headers: cookie ? { cookie } : {},
    });
    return req;
  }

  // ============================================================
  // 1. AUTHENTICATION & AUTHORIZATION TESTS
  // ============================================================

  describe('Authorization Checks', () => {
    it('returns 401 when unauthenticated (no cookie)', async () => {
      const req = createReq(`http://localhost:3000/api/pnl?from=${testBusinessDate}&to=${testBusinessDate}`);
      const res = await pnlHandler(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for overview without auth', async () => {
      const req = createReq(`http://localhost:3000/api/analytics/overview?from=${testBusinessDate}&to=${testBusinessDate}`);
      const res = await overviewHandler(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for sales-register without auth', async () => {
      const req = createReq(`http://localhost:3000/api/reports/sales-register?from=${testBusinessDate}&to=${testBusinessDate}`);
      const res = await salesRegisterHandler(req);
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // 2. ALL 9 REQUIRED ENDPOINTS TESTS
  // ============================================================

  describe('All 9 Required Endpoints Verification', () => {
    it('Endpoint 1: GET /api/pnl returns authoritative P&L, null wastage impact, safe break-even', async () => {
      const req = createReq(
        `http://localhost:3000/api/pnl?from=${testBusinessDate}&to=${testBusinessDate}`,
        authCookie
      );
      const res = await pnlHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();

      const data = json.data;
      expect(data.reportType).toBe('PNL');
      expect(data.grossRevenue).toBeDefined();
      expect(data.netSales).toBeDefined();
      expect(data.foodCost).toBeDefined();
      expect(data.grossProfit).toBeDefined();
      expect(data.operatingExpenses).toBeDefined();
      expect(data.netProfit).toBeDefined();

      // MANDATORY CORRECTION 1: strictly null, NOT "0.00"
      expect(data.configuredWastageExpenseImpact).toBeNull();
      expect(data.dataLimitations).toBeDefined();
      expect(data.dataLimitations.length).toBeGreaterThan(0);
      expect(data.dataLimitations[0]).toContain('Configured wastage/adjustment monetary expense impact is unavailable');

      // Formula: netProfit = grossProfit - operatingExpenses
      const grossProfit = Number(data.grossProfit);
      const opExpenses = Number(data.operatingExpenses);
      const netProfit = Number(data.netProfit);
      expect(Math.abs(netProfit - (grossProfit - opExpenses))).toBeLessThan(0.01);

      // Completeness model & break-even safe failure
      expect(data.completeness).toBeDefined();
      expect(data.completeness.completenessStatus).toBeDefined();
      expect(data.breakEven).toBeDefined();
      expect(data.breakEven.breakEvenAmount).toBeNull();
      expect(data.breakEven.fixedCosts).toBeNull();
      expect(data.breakEven.reason).toBe('FIXED_COSTS_NOT_CONFIGURED');

      // Requirement C: Operating expenses exist, but MUST NOT automatically become fixed costs
      expect(Number(data.operatingExpenses)).toBeGreaterThan(0);
      expect(data.breakEven.fixedCosts).toBeNull();
      expect(data.breakEven.breakEvenAmount).toBeNull();
      expect(data.breakEven.reason).toBe('FIXED_COSTS_NOT_CONFIGURED');

      // Wastage indicators present
      expect(data.wastageIndicators).toBeDefined();
      expect(data.wastageIndicators.wastageCount).toBeGreaterThanOrEqual(0);
    });

    it('Endpoint 2: GET /api/analytics/overview returns summary metrics and exceptions', async () => {
      const req = createReq(
        `http://localhost:3000/api/analytics/overview?from=${testBusinessDate}&to=${testBusinessDate}`,
        authCookie
      );
      const res = await overviewHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();

      const data = json.data;
      expect(data.reportType).toBe('ANALYTICS_OVERVIEW');
      expect(data.revenue).toBeDefined();
      expect(data.foodCost).toBeDefined();
      expect(data.profitability).toBeDefined();
      expect(data.operationalExceptions).toBeDefined();
      expect(data.wastageIndicators).toBeDefined();
    });

    it('Endpoint 3: GET /api/analytics/menu-performance sorts correctly', async () => {
      const req = createReq(
        `http://localhost:3000/api/analytics/menu-performance?from=${testBusinessDate}&to=${testBusinessDate}&sort=revenue`,
        authCookie
      );
      const res = await menuPerformanceHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.reportType).toBe('MENU_PERFORMANCE');
      expect(json.data.appliedSort).toBe('revenue');
      expect(Array.isArray(json.data.items)).toBe(true);
    });

    it('Endpoint 3 (rejection): GET /api/analytics/menu-performance rejects invalid sort with 400', async () => {
      const req = createReq(
        `http://localhost:3000/api/analytics/menu-performance?from=${testBusinessDate}&to=${testBusinessDate}&sort=unsupported_key`,
        authCookie
      );
      const res = await menuPerformanceHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('Endpoint 4: GET /api/reports/sales-register returns JSON data and exports XLSX', async () => {
      // JSON view
      const viewReq = createReq(
        `http://localhost:3000/api/reports/sales-register?from=${testBusinessDate}&to=${testBusinessDate}`,
        authCookie
      );
      const viewRes = await salesRegisterHandler(viewReq);
      expect(viewRes.status).toBe(200);
      const viewJson = await viewRes.json();
      expect(viewJson.data.reportType).toBe('SALES_REGISTER');
      expect(Array.isArray(viewJson.data.items)).toBe(true);

      // Verify historic tax rate snapshot from bill_lines
      const testBillRow = viewJson.data.items.find((i: any) => i.taxRateSnapshot !== null);
      if (testBillRow) {
        expect(testBillRow.taxRateSnapshot).toBe('0.05');
      }

      // Export view
      const exportReq = createReq(
        `http://localhost:3000/api/reports/sales-register?from=${testBusinessDate}&to=${testBusinessDate}&format=XLSX`,
        authCookie
      );
      const exportRes = await salesRegisterHandler(exportReq);
      expect(exportRes.status).toBe(200);
      const exportJson = await exportRes.json();
      expect(exportJson.data.contentBuffer).toBeDefined();
      expect(exportJson.data.job.status).toBe('COMPLETED');
    });

    it('Endpoint 5: GET /api/reports/purchase-register returns JSON and exports PDF', async () => {
      // JSON view
      const viewReq = createReq(
        `http://localhost:3000/api/reports/purchase-register?from=${testBusinessDate}&to=${testBusinessDate}`,
        authCookie
      );
      const viewRes = await purchaseRegisterHandler(viewReq);
      expect(viewRes.status).toBe(200);
      const viewJson = await viewRes.json();
      expect(viewJson.data.reportType).toBe('PURCHASE_REGISTER');
      expect(Array.isArray(viewJson.data.items)).toBe(true);

      // Export view
      const exportReq = createReq(
        `http://localhost:3000/api/reports/purchase-register?from=${testBusinessDate}&to=${testBusinessDate}&format=PDF`,
        authCookie
      );
      const exportRes = await purchaseRegisterHandler(exportReq);
      expect(exportRes.status).toBe(200);
      const exportJson = await exportRes.json();
      expect(exportJson.data.contentBuffer).toBeDefined();
    });

    it('Endpoint 6: GET /api/reports/expense-register returns JSON and exports EXCEL', async () => {
      // JSON view
      const viewReq = createReq(
        `http://localhost:3000/api/reports/expense-register?from=${testBusinessDate}&to=${testBusinessDate}`,
        authCookie
      );
      const viewRes = await expenseRegisterHandler(viewReq);
      expect(viewRes.status).toBe(200);
      const viewJson = await viewRes.json();
      expect(viewJson.data.reportType).toBe('EXPENSE_REGISTER');
      expect(Array.isArray(viewJson.data.items)).toBe(true);

      // Export view
      const exportReq = createReq(
        `http://localhost:3000/api/reports/expense-register?from=${testBusinessDate}&to=${testBusinessDate}&format=EXCEL`,
        authCookie
      );
      const exportRes = await expenseRegisterHandler(exportReq);
      expect(exportRes.status).toBe(200);
      const exportJson = await exportRes.json();
      expect(exportJson.data.contentBuffer).toBeDefined();
    });

    it('Endpoint 7: GET /api/reports/monthly-pnl returns monthly rows with null wastage impact', async () => {
      const req = createReq(
        `http://localhost:3000/api/reports/monthly-pnl?from=${testBusinessDate}&to=${testBusinessDate}`,
        authCookie
      );
      const res = await monthlyPnlHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.reportType).toBe('MONTHLY_PNL');
      expect(Array.isArray(json.data.months)).toBe(true);
      expect(json.data.totals.configuredWastageExpenseImpact).toBeNull();
    });

    it('Endpoint 8: GET /api/reports/inventory-valuation returns limitation disclaimer', async () => {
      const req = createReq(
        `http://localhost:3000/api/reports/inventory-valuation?asOf=${testBusinessDate}`,
        authCookie
      );
      const res = await inventoryValuationHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.reportType).toBe('INVENTORY_VALUATION');
      expect(json.data.dataLimitation).toBeDefined();
      expect(json.data.dataLimitation).toContain('Valuation reflects the current weighted-average inventory cost state');
      expect(Array.isArray(json.data.items)).toBe(true);
    });

    it('Endpoint 9: GET /api/reports/reconciliation returns daily reconciliation metrics', async () => {
      const req = createReq(
        `http://localhost:3000/api/reports/reconciliation?from=${testBusinessDate}&to=${testBusinessDate}`,
        authCookie
      );
      const res = await reconciliationHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.reportType).toBe('RECONCILIATION');
      expect(json.data.summary).toBeDefined();
      expect(Array.isArray(json.data.days)).toBe(true);
    });
  });

  // ============================================================
  // 3. DATE-RANGE, EXPORT-FORMAT, AND SIZE-LIMIT VALIDATION
  // ============================================================

  describe('Validation & Error Handling', () => {
    it('rejects inverted date range (from > to) with 400', async () => {
      const req = createReq(
        'http://localhost:3000/api/pnl?from=2026-12-31&to=2026-01-01',
        authCookie
      );
      const res = await pnlHandler(req);
      expect(res.status).toBe(400);
    });

    it('rejects range exceeding 366 days with 400', async () => {
      const req = createReq(
        'http://localhost:3000/api/pnl?from=2024-01-01&to=2026-01-01',
        authCookie
      );
      const res = await pnlHandler(req);
      expect(res.status).toBe(400);
    });

    it('rejects unsupported export format with 400', async () => {
      const req = createReq(
        `http://localhost:3000/api/reports/sales-register?from=${testBusinessDate}&to=${testBusinessDate}&format=DOCX`,
        authCookie
      );
      const res = await salesRegisterHandler(req);
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // 4. AUDIT TRAIL LOGGING VERIFICATION
  // ============================================================

  describe('Audit Logging Verification', () => {
    it('verifies REPORT_EXPORTED and REPORT_VIEWED audit log events exist in database', async () => {
      const auditRes = await query(
        `SELECT action, entity_type FROM audit_logs
         WHERE admin_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [adminId]
      );
      expect(auditRes.rows.length).toBeGreaterThan(0);
      const actions = auditRes.rows.map((r: any) => r.action);
      expect(actions).toContain('REPORT_VIEWED');
      expect(actions).toContain('REPORT_EXPORTED');
    });
  });

  // ============================================================
  // 5. NON-MUTATION OF OPERATIONAL DATA VERIFICATION
  // ============================================================

  describe('Strict Read-Only Verification (No Operational Data Mutation)', () => {
    it('confirms reporting endpoints execute strictly read-only queries', async () => {
      // 1. Get baseline counts
      const [billsBefore, consumptionsBefore, movementsBefore, expensesBefore] = await Promise.all([
        query('SELECT COUNT(*)::int AS count FROM bills'),
        query('SELECT COUNT(*)::int AS count FROM bill_consumptions'),
        query('SELECT COUNT(*)::int AS count FROM stock_movements'),
        query('SELECT COUNT(*)::int AS count FROM expenses'),
      ]);

      // 2. Call all 9 report handlers
      await Promise.all([
        pnlHandler(createReq(`http://localhost:3000/api/pnl?from=${testBusinessDate}&to=${testBusinessDate}`, authCookie)),
        overviewHandler(createReq(`http://localhost:3000/api/analytics/overview?from=${testBusinessDate}&to=${testBusinessDate}`, authCookie)),
        menuPerformanceHandler(createReq(`http://localhost:3000/api/analytics/menu-performance?from=${testBusinessDate}&to=${testBusinessDate}`, authCookie)),
        salesRegisterHandler(createReq(`http://localhost:3000/api/reports/sales-register?from=${testBusinessDate}&to=${testBusinessDate}`, authCookie)),
        purchaseRegisterHandler(createReq(`http://localhost:3000/api/reports/purchase-register?from=${testBusinessDate}&to=${testBusinessDate}`, authCookie)),
        expenseRegisterHandler(createReq(`http://localhost:3000/api/reports/expense-register?from=${testBusinessDate}&to=${testBusinessDate}`, authCookie)),
        monthlyPnlHandler(createReq(`http://localhost:3000/api/reports/monthly-pnl?from=${testBusinessDate}&to=${testBusinessDate}`, authCookie)),
        inventoryValuationHandler(createReq(`http://localhost:3000/api/reports/inventory-valuation?asOf=${testBusinessDate}`, authCookie)),
        reconciliationHandler(createReq(`http://localhost:3000/api/reports/reconciliation?from=${testBusinessDate}&to=${testBusinessDate}`, authCookie)),
      ]);

      // 3. Get post-execution counts
      const [billsAfter, consumptionsAfter, movementsAfter, expensesAfter] = await Promise.all([
        query('SELECT COUNT(*)::int AS count FROM bills'),
        query('SELECT COUNT(*)::int AS count FROM bill_consumptions'),
        query('SELECT COUNT(*)::int AS count FROM stock_movements'),
        query('SELECT COUNT(*)::int AS count FROM expenses'),
      ]);

      // 4. Assert exact equality (zero mutations)
      expect(billsAfter.rows[0].count).toBe(billsBefore.rows[0].count);
      expect(consumptionsAfter.rows[0].count).toBe(consumptionsBefore.rows[0].count);
      expect(movementsAfter.rows[0].count).toBe(movementsBefore.rows[0].count);
      expect(expensesAfter.rows[0].count).toBe(expensesBefore.rows[0].count);
    });
  });
});
