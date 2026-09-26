import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { query } from '@/shared/database/client';
import { SupplierRepository } from '@/modules/supplier/supplier.repository';
import { InventoryRepository } from '@/modules/inventory/inventory.repository';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { AuthRepository } from '@/modules/auth/auth.repository';
import { hashPassword, generateSessionToken } from '@/shared/auth/security';
import { createSessionCookie } from '@/shared/auth/session';

import { GET as listPurchasesHandler, POST as createPurchaseHandler } from '@/app/api/purchases/route';
import { GET as getPurchaseHandler, PATCH as updatePurchaseHandler } from '@/app/api/purchases/[id]/route';
import { POST as receivePurchaseHandler } from '@/app/api/purchases/[id]/receive/route';
import { POST as reversePurchaseHandler } from '@/app/api/purchases/[id]/reverse/route';

describe('Purchases API HTTP Integration Tests (Step 3)', { timeout: 35000 }, () => {
  let adminId: string;
  let authCookie: string;
  let testSupplierId: string;
  let testItemId: string;

  beforeAll(async () => {
    // 1. Ensure test admin with session exists
    const email = `purchase_api_admin_${Date.now()}@koyal.com`;
    const passwordHash = await hashPassword('AdminPass123!');
    const admin = await AuthRepository.createAdmin({
      email,
      passwordHash,
      displayName: 'API Admin'
    });
    adminId = admin.id;

    const { rawToken, tokenHash } = generateSessionToken();
    await AuthRepository.createSession({
      adminId: admin.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 86400 * 1000)
    });
    authCookie = createSessionCookie(rawToken);

    // 2. Create Active Supplier
    const supplier = await SupplierRepository.create(
      {
        name: `API Test Supplier ${Date.now()}`,
        contactPerson: 'Harish'
      },
      adminId
    );
    testSupplierId = supplier.id;

    // 3. Create Active Item
    const item = await InventoryRepository.create(
      {
        name: `API Test Item ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '5.000'
      },
      adminId
    );
    testItemId = item.id;
  });

  afterAll(async () => {
    // Cleanup created records in foreign-key order
    await query('DELETE FROM purchase_reversals WHERE purchase_id IN (SELECT id FROM purchases WHERE created_by = $1)', [adminId]);
    await query('DELETE FROM purchase_lines WHERE purchase_id IN (SELECT id FROM purchases WHERE created_by = $1)', [adminId]);
    await query('DELETE FROM purchases WHERE created_by = $1', [adminId]);
    await query('DELETE FROM stock_movements WHERE inventory_item_id = $1', [testItemId]);
    await query('DELETE FROM inventory_balances WHERE inventory_item_id = $1', [testItemId]);
    await query('DELETE FROM inventory_items WHERE id = $1', [testItemId]);
    await query('DELETE FROM suppliers WHERE id = $1', [testSupplierId]);
    await query('DELETE FROM audit_logs WHERE admin_id = $1', [adminId]);
    await query('DELETE FROM sessions WHERE admin_id = $1', [adminId]);
    await query('DELETE FROM admins WHERE id = $1', [adminId]);
  });

  function createRequest(
    url: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      authenticated?: boolean;
    } = {}
  ): NextRequest {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(options.headers || {})
    };
    if (options.authenticated !== false) {
      headers['cookie'] = authCookie;
    }

    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  }

  // =========================================================================
  // 1. AUTHENTICATION
  // =========================================================================
  describe('Authentication Enforcement', () => {
    it('1. unauthenticated GET /api/purchases is rejected with 401', async () => {
      const req = createRequest('http://localhost:3000/api/purchases', { authenticated: false });
      const res = await listPurchasesHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('2. unauthenticated POST /api/purchases is rejected with 401', async () => {
      const req = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: { purchaseDate: '2026-09-26' },
        authenticated: false
      });
      const res = await createPurchaseHandler(req);
      expect(res.status).toBe(401);
    });

    it('3. unauthenticated POST /api/purchases/:id/receive is rejected with 401', async () => {
      const dummyId = '00000000-0000-0000-0000-000000000001';
      const req = createRequest(`http://localhost:3000/api/purchases/${dummyId}/receive`, {
        method: 'POST',
        headers: { 'idempotency-key': 'test-key' },
        authenticated: false
      });
      const res = await receivePurchaseHandler(req, { params: { id: dummyId } });
      expect(res.status).toBe(401);
    });

    it('4. unauthenticated POST /api/purchases/:id/reverse is rejected with 401', async () => {
      const dummyId = '00000000-0000-0000-0000-000000000001';
      const req = createRequest(`http://localhost:3000/api/purchases/${dummyId}/reverse`, {
        method: 'POST',
        body: { reason: 'Test reason' },
        headers: { 'idempotency-key': 'test-key' },
        authenticated: false
      });
      const res = await reversePurchaseHandler(req, { params: { id: dummyId } });
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 2. CREATE DRAFT
  // =========================================================================
  describe('Create Draft API', () => {
    it('5. valid supplier purchase returns 201 Created with server-calculated totals', async () => {
      const req = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          invoiceNumber: 'INV-API-01',
          discount: 10,
          taxAmount: 5,
          lines: [
            {
              inventoryItemId: testItemId,
              quantity: 5,
              unitRate: 100,
              lineDiscount: 20,
              taxRate: 5
            }
          ]
        }
      });
      const res = await createPurchaseHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.purchase).toBeDefined();
      expect(json.data.purchase.purchase_number).toMatch(/^KP-20260926-\d{4}$/);
      expect(json.data.purchase.status).toBe('DRAFT');
      // Line: 5*100 = 500 - 20 = 480 * 1.05 = 504.00
      // Grand total: 504 - 10 + 5 = 499.00
      expect(json.data.purchase.grand_total).toBe('499.00');
    });

    it('6. ad-hoc supplier purchase returns 201 Created', async () => {
      const req = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          adhocSupplierName: 'Direct Cash Farmer',
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId, quantity: 2, unitRate: 50 }]
        }
      });
      const res = await createPurchaseHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.purchase.supplier_id).toBeNull();
      expect(json.data.purchase.supplier_name).toBe('Direct Cash Farmer');
    });

    it('7. invalid body (missing required fields) is rejected with 400', async () => {
      const req = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: { paymentMethod: 'INVALID' }
      });
      const res = await createPurchaseHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('8. empty lines array is rejected with 400', async () => {
      const req = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: []
        }
      });
      const res = await createPurchaseHandler(req);
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 3. READ & LIST
  // =========================================================================
  describe('Read and List API', () => {
    let createdPurchaseId: string;

    beforeAll(async () => {
      const req = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId, quantity: 1, unitRate: 100 }]
        }
      });
      const res = await createPurchaseHandler(req);
      const json = await res.json();
      createdPurchaseId = json.data.purchase.id;
    });

    it('9. GET /api/purchases lists purchases with pagination metadata', async () => {
      const req = createRequest('http://localhost:3000/api/purchases?page=1&pageSize=10');
      const res = await listPurchasesHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data.items)).toBe(true);
      expect(json.data.pagination).toBeDefined();
      expect(json.data.pagination.page).toBe(1);
    });

    it('10. GET /api/purchases with status filter', async () => {
      const req = createRequest('http://localhost:3000/api/purchases?status=DRAFT');
      const res = await listPurchasesHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items.every((p: any) => p.status === 'DRAFT')).toBe(true);
    });

    it('11. GET /api/purchases with supplier filter', async () => {
      const req = createRequest(`http://localhost:3000/api/purchases?supplierId=${testSupplierId}`);
      const res = await listPurchasesHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items.every((p: any) => p.supplier_id === testSupplierId)).toBe(true);
    });

    it('12. GET /api/purchases with date range filter', async () => {
      const req = createRequest('http://localhost:3000/api/purchases?startDate=2026-09-01&endDate=2026-09-30');
      const res = await listPurchasesHandler(req);
      expect(res.status).toBe(200);
    });

    it('13. GET /api/purchases/:id retrieves detail with lines and snapshots', async () => {
      const req = createRequest(`http://localhost:3000/api/purchases/${createdPurchaseId}`);
      const res = await getPurchaseHandler(req, { params: { id: createdPurchaseId } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.purchase.id).toBe(createdPurchaseId);
      expect(json.data.purchase.lines).toHaveLength(1);
      expect(json.data.purchase.lines[0].item_name).toBeDefined();
      expect(json.data.purchase.lines[0].unit).toBe('KG');
    });

    it('14. unknown purchase ID returns 404', async () => {
      const unknownId = 'a0000000-0000-0000-0000-000000000099';
      const req = createRequest(`http://localhost:3000/api/purchases/${unknownId}`);
      const res = await getPurchaseHandler(req, { params: { id: unknownId } });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  // =========================================================================
  // 4. UPDATE DRAFT
  // =========================================================================
  describe('Update Draft API', () => {
    it('15. PATCH /api/purchases/:id updates DRAFT and recalculates totals', async () => {
      // Create draft
      const postReq = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId, quantity: 2, unitRate: 50 }]
        }
      });
      const postRes = await createPurchaseHandler(postReq);
      const { purchase } = (await postRes.json()).data;

      // Update draft
      const patchReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}`, {
        method: 'PATCH',
        body: {
          discount: 15,
          lines: [{ inventoryItemId: testItemId, quantity: 4, unitRate: 50 }]
        }
      });
      const patchRes = await updatePurchaseHandler(patchReq, { params: { id: purchase.id } });
      expect(patchRes.status).toBe(200);
      const patchJson = await patchRes.json();
      // 4 * 50 = 200 - 15 = 185
      expect(patchJson.data.purchase.grand_total).toBe('185.00');
    });

    it('16. PATCH on RECEIVED purchase is rejected with 400 PURCHASE_NOT_EDITABLE', async () => {
      const postReq = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId, quantity: 1, unitRate: 20 }]
        }
      });
      const postRes = await createPurchaseHandler(postReq);
      const { purchase } = (await postRes.json()).data;

      // Receive
      const recvReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/receive`, {
        method: 'POST',
        headers: { 'idempotency-key': `recv-edit-test-${Date.now()}` }
      });
      await receivePurchaseHandler(recvReq, { params: { id: purchase.id } });

      // Attempt to patch
      const patchReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}`, {
        method: 'PATCH',
        body: { discount: 5 }
      });
      const patchRes = await updatePurchaseHandler(patchReq, { params: { id: purchase.id } });
      expect(patchRes.status).toBe(400);
      const patchJson = await patchRes.json();
      expect(patchJson.error.code).toBe('PURCHASE_NOT_EDITABLE');
    });
  });

  // =========================================================================
  // 5. RECEIVE
  // =========================================================================
  describe('Receive Purchase API', () => {
    it('17. receive without Idempotency-Key header is rejected with 400', async () => {
      const dummyId = '00000000-0000-0000-0000-000000000001';
      const req = createRequest(`http://localhost:3000/api/purchases/${dummyId}/receive`, {
        method: 'POST'
      });
      const res = await receivePurchaseHandler(req, { params: { id: dummyId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain('Idempotency-Key');
    });

    it('18. valid receive succeeds and transitions to RECEIVED', async () => {
      const postReq = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId, quantity: 10, unitRate: 50 }]
        }
      });
      const postRes = await createPurchaseHandler(postReq);
      const { purchase } = (await postRes.json()).data;

      const idempotencyKey = `api-recv-success-${Date.now()}`;
      const recvReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/receive`, {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey }
      });
      const recvRes = await receivePurchaseHandler(recvReq, { params: { id: purchase.id } });
      expect(recvRes.status).toBe(200);
      const recvJson = await recvRes.json();
      expect(recvJson.data.purchase.status).toBe('RECEIVED');
      expect(recvJson.data.purchase.received_at).toBeDefined();

      // Replay with identical idempotency key returns cached 200 without duplicate execution
      const replayReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/receive`, {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey }
      });
      const replayRes = await receivePurchaseHandler(replayReq, { params: { id: purchase.id } });
      expect(replayRes.status).toBe(200);

      // Same idempotency key on a DIFFERENT purchase is rejected with 409
      const otherDummyId = '11111111-1111-1111-1111-111111111111';
      const conflictReq = createRequest(`http://localhost:3000/api/purchases/${otherDummyId}/receive`, {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey }
      });
      const conflictRes = await receivePurchaseHandler(conflictReq, { params: { id: otherDummyId } });
      expect(conflictRes.status).toBe(409);
    });

    it('19. already received purchase with new idempotency key is rejected with 400', async () => {
      const postReq = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId, quantity: 2, unitRate: 10 }]
        }
      });
      const postRes = await createPurchaseHandler(postReq);
      const { purchase } = (await postRes.json()).data;

      // First receive
      const recvReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/receive`, {
        method: 'POST',
        headers: { 'idempotency-key': `key1-${Date.now()}` }
      });
      await receivePurchaseHandler(recvReq, { params: { id: purchase.id } });

      // Second receive with new key
      const secondReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/receive`, {
        method: 'POST',
        headers: { 'idempotency-key': `key2-${Date.now()}` }
      });
      const secondRes = await receivePurchaseHandler(secondReq, { params: { id: purchase.id } });
      expect(secondRes.status).toBe(400);
      const secondJson = await secondRes.json();
      expect(secondJson.error.code).toBe('PURCHASE_ALREADY_RECEIVED');
    });
  });

  // =========================================================================
  // 6. REVERSE
  // =========================================================================
  describe('Reverse Purchase API', () => {
    it('20. reverse without Idempotency-Key header is rejected with 400', async () => {
      const dummyId = '00000000-0000-0000-0000-000000000001';
      const req = createRequest(`http://localhost:3000/api/purchases/${dummyId}/reverse`, {
        method: 'POST',
        body: { reason: 'Wrong quantity delivered' }
      });
      const res = await reversePurchaseHandler(req, { params: { id: dummyId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain('Idempotency-Key');
    });

    it('21. valid reversal succeeds, records reason, and transitions to REVERSED', async () => {
      const postReq = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId, quantity: 3, unitRate: 50 }]
        }
      });
      const postRes = await createPurchaseHandler(postReq);
      const { purchase } = (await postRes.json()).data;

      // Receive
      const recvReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/receive`, {
        method: 'POST',
        headers: { 'idempotency-key': `recv-for-rev-api-${Date.now()}` }
      });
      await receivePurchaseHandler(recvReq, { params: { id: purchase.id } });

      // Reverse
      const revKey = `api-rev-success-${Date.now()}`;
      const revReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/reverse`, {
        method: 'POST',
        headers: { 'idempotency-key': revKey },
        body: { reason: 'Damaged shipment returned to vendor' }
      });
      const revRes = await reversePurchaseHandler(revReq, { params: { id: purchase.id } });
      expect(revRes.status).toBe(200);
      const revJson = await revRes.json();
      expect(revJson.data.purchase.status).toBe('REVERSED');
      expect(revJson.data.purchase.reversal.reason).toBe('Damaged shipment returned to vendor');

      // Idempotency replay
      const replayReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/reverse`, {
        method: 'POST',
        headers: { 'idempotency-key': revKey },
        body: { reason: 'Damaged shipment returned to vendor' }
      });
      const replayRes = await reversePurchaseHandler(replayReq, { params: { id: purchase.id } });
      expect(replayRes.status).toBe(200);
    });

    it('22. reversing a DRAFT purchase is rejected with 400 PURCHASE_NOT_REVERSIBLE', async () => {
      const postReq = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId, quantity: 1, unitRate: 10 }]
        }
      });
      const postRes = await createPurchaseHandler(postReq);
      const { purchase } = (await postRes.json()).data;

      const revReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/reverse`, {
        method: 'POST',
        headers: { 'idempotency-key': `rev-draft-${Date.now()}` },
        body: { reason: 'Attempting to reverse draft' }
      });
      const revRes = await reversePurchaseHandler(revReq, { params: { id: purchase.id } });
      expect(revRes.status).toBe(400);
      const revJson = await revRes.json();
      expect(revJson.error.code).toBe('PURCHASE_NOT_REVERSIBLE');
    });

    it('23. already reversed purchase with new key is rejected with 400', async () => {
      const postReq = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId, quantity: 1, unitRate: 10 }]
        }
      });
      const postRes = await createPurchaseHandler(postReq);
      const { purchase } = (await postRes.json()).data;

      // Receive
      const recvReq = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/receive`, {
        method: 'POST',
        headers: { 'idempotency-key': `recv-${Date.now()}` }
      });
      await receivePurchaseHandler(recvReq, { params: { id: purchase.id } });

      // First reverse
      const revReq1 = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/reverse`, {
        method: 'POST',
        headers: { 'idempotency-key': `rev1-${Date.now()}` },
        body: { reason: 'First reversal reason' }
      });
      await reversePurchaseHandler(revReq1, { params: { id: purchase.id } });

      // Second reverse with new key
      const revReq2 = createRequest(`http://localhost:3000/api/purchases/${purchase.id}/reverse`, {
        method: 'POST',
        headers: { 'idempotency-key': `rev2-${Date.now()}` },
        body: { reason: 'Second reversal attempt' }
      });
      const revRes2 = await reversePurchaseHandler(revReq2, { params: { id: purchase.id } });
      expect(revRes2.status).toBe(400);
      const revJson2 = await revRes2.json();
      expect(revJson2.error.code).toBe('PURCHASE_ALREADY_REVERSED');
    });
  });

  // =========================================================================
  // 7. SECURITY & VALIDATION BOUNDARIES
  // =========================================================================
  describe('Security & Validation Boundaries', () => {
    it('24. malformed UUID path parameter is rejected with 400 VALIDATION_ERROR', async () => {
      const req = createRequest('http://localhost:3000/api/purchases/not-a-valid-uuid');
      const res = await getPurchaseHandler(req, { params: { id: 'not-a-valid-uuid' } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('25. invalid filter values (e.g. invalid date format) rejected with 400', async () => {
      const req = createRequest('http://localhost:3000/api/purchases?startDate=26-09-2026');
      const res = await listPurchasesHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain('YYYY-MM-DD');
    });

    it('26. invalid pagination boundaries (e.g. pageSize > 100) rejected with 400', async () => {
      const req = createRequest('http://localhost:3000/api/purchases?pageSize=500');
      const res = await listPurchasesHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain('between 1 and 100');
    });

    it('27. errors do not leak SQL or database connection internals', async () => {
      const req = createRequest('http://localhost:3000/api/purchases', {
        method: 'POST',
        body: {
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: '00000000-0000-0000-0000-000000000000', quantity: 1, unitRate: 10 }]
        }
      });
      const res = await createPurchaseHandler(req);
      const json = await res.json();
      const stringified = JSON.stringify(json);
      expect(stringified).not.toContain('SELECT');
      expect(stringified).not.toContain('INSERT');
      expect(stringified).not.toContain('postgres');
    });
  });
});
