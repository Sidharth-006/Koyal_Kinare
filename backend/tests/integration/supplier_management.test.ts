import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SupplierService } from '@/modules/supplier/supplier.service';
import { DuplicateSupplierError, NotFoundError, ValidationError } from '@/shared/errors';
import { query } from '@/shared/database/client';

describe('Supplier Management Integration Tests', () => {
  const testAdminId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    await query(`
      INSERT INTO admins (id, email, password_hash, display_name)
      VALUES ($1, 'supplier_test@cafe.com', 'hash', 'Test Admin')
      ON CONFLICT (id) DO NOTHING;
    `, [testAdminId]);

    await query(`DELETE FROM suppliers WHERE name LIKE 'TEST_SUPP_%' OR name LIKE 'test_supp_%';`);
  });

  afterAll(async () => {
    await query(`DELETE FROM suppliers WHERE name LIKE 'TEST_SUPP_%' OR name LIKE 'test_supp_%';`);
  });

  it('should create an active supplier with all optional fields normalized', async () => {
    const supplier = await SupplierService.createSupplier(
      {
        name: '  TEST_SUPP_Dairy_Farm  ',
        contactPerson: '  Ramesh Kumar  ',
        phone: '  +91 9876543210  ',
        email: '  Ramesh@DairyFarm.com  ',
        address: '  Plot 45, Village Milk Road  ',
        gstin: '  27AAPFU0939F1ZV  ',
        notes: '  Prompt morning delivery  '
      },
      testAdminId
    );

    expect(supplier).toBeDefined();
    expect(supplier.id).toBeDefined();
    expect(supplier.name).toBe('TEST_SUPP_Dairy_Farm');
    expect(supplier.contact_person).toBe('Ramesh Kumar');
    expect(supplier.phone).toBe('+91 9876543210');
    expect(supplier.email).toBe('ramesh@dairyfarm.com');
    expect(supplier.address).toBe('Plot 45, Village Milk Road');
    expect(supplier.gstin).toBe('27AAPFU0939F1ZV');
    expect(supplier.notes).toBe('Prompt morning delivery');
    expect(supplier.is_archived).toBe(false);
  });

  it('should reject creating duplicate active supplier name case-insensitively', async () => {
    await expect(
      SupplierService.createSupplier(
        {
          name: 'test_supp_dairy_farm' // lowercase duplicate
        },
        testAdminId
      )
    ).rejects.toThrow(DuplicateSupplierError);
  });

  it('should read supplier by ID', async () => {
    const created = await SupplierService.createSupplier(
      { name: 'TEST_SUPP_Spice_Mart' },
      testAdminId
    );

    const fetched = await SupplierService.getSupplierById(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe('TEST_SUPP_Spice_Mart');
  });

  it('should throw NotFoundError for non-existent supplier ID', async () => {
    await expect(
      SupplierService.getSupplierById('00000000-0000-0000-0000-999999999999')
    ).rejects.toThrow(NotFoundError);
  });

  it('should list suppliers with search, status filter, and pageSize pagination', async () => {
    const list = await SupplierService.listSuppliers({
      search: 'Spice_Mart',
      status: 'active',
      page: 1,
      pageSize: 10
    });

    expect(list.items.length).toBeGreaterThanOrEqual(1);
    expect(list.items[0].name).toBe('TEST_SUPP_Spice_Mart');
    expect(list.pagination.pageSize).toBe(10);
    expect(list.pagination.total).toBeGreaterThanOrEqual(1);
    expect(list.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('should update supplier details', async () => {
    const created = await SupplierService.createSupplier(
      {
        name: 'TEST_SUPP_Packaging_Co',
        contactPerson: 'Old Contact'
      },
      testAdminId
    );

    const updated = await SupplierService.updateSupplier(
      created.id,
      {
        contactPerson: 'New Contact',
        notes: 'Updated note'
      },
      testAdminId
    );

    expect(updated.contact_person).toBe('New Contact');
    expect(updated.notes).toBe('Updated note');
  });

  it('should archive and restore a supplier, verifying active name partial index behavior', async () => {
    const created = await SupplierService.createSupplier(
      { name: 'TEST_SUPP_Tea_Estate' },
      testAdminId
    );

    // 1. Archive
    const archived = await SupplierService.archiveSupplier(created.id, testAdminId);
    expect(archived.is_archived).toBe(true);

    // 2. An active supplier with the same name can now be created because previous one is archived
    const newActive = await SupplierService.createSupplier(
      { name: 'TEST_SUPP_Tea_Estate' },
      testAdminId
    );
    expect(newActive.id).not.toBe(created.id);

    // 3. Attempting to restore the original archived supplier must fail because active duplicate exists
    await expect(
      SupplierService.restoreSupplier(created.id, testAdminId)
    ).rejects.toThrow(DuplicateSupplierError);

    // 4. Archive the new one, now original can be restored
    await SupplierService.archiveSupplier(newActive.id, testAdminId);
    const restored = await SupplierService.restoreSupplier(created.id, testAdminId);
    expect(restored.is_archived).toBe(false);
  });

  it('should safely return zero/empty purchase summary with exact DLD fields before purchases exist', async () => {
    const created = await SupplierService.createSupplier(
      { name: 'TEST_SUPP_Beverages' },
      testAdminId
    );

    const summary = await SupplierService.getPurchaseSummary(created.id, {
      from: '2026-01-01',
      to: '2026-12-31',
      page: 1,
      pageSize: 20
    });

    expect(summary).toBeDefined();
    expect(summary.supplierId).toBe(created.id);
    expect(summary.totalPurchasesCount).toBe(0);
    expect(summary.totalPurchasesAmount).toBe(0);
    expect(summary.receivedPurchasesCount).toBe(0);
    expect(summary.receivedPurchasesAmount).toBe(0);
    expect(summary.recentPurchases).toEqual([]);
    expect(summary.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0
    });
  });

  it('should record audit events for supplier lifecycle', async () => {
    const supplier = await SupplierService.createSupplier(
      { name: 'TEST_SUPP_Audit_Check' },
      testAdminId
    );

    await SupplierService.updateSupplier(
      supplier.id,
      { notes: 'Audited Update' },
      testAdminId
    );

    await SupplierService.archiveSupplier(supplier.id, testAdminId);
    await SupplierService.restoreSupplier(supplier.id, testAdminId);

    const { rows: auditRows } = await query(
      `SELECT action, entity_id FROM audit_logs WHERE entity_id = $1 ORDER BY created_at ASC`,
      [supplier.id]
    );

    const actions = auditRows.map(r => r.action);
    expect(actions).toContain('SUPPLIER_CREATED');
    expect(actions).toContain('SUPPLIER_UPDATED');
    expect(actions).toContain('SUPPLIER_ARCHIVED');
    expect(actions).toContain('SUPPLIER_RESTORED');
  });

  it('should support idempotency for supplier creation', async () => {
    const idempotencyKey = 'test-idemp-' + Date.now();
    const payload = {
      name: 'TEST_SUPP_Idemp_Test',
      contactPerson: 'Idemp User',
      idempotencyKey
    };

    const first = await SupplierService.createSupplier(payload, testAdminId);
    const second = await SupplierService.createSupplier(payload, testAdminId);

    expect(first.id).toBe(second.id);
    expect(first.name).toBe(second.name);
  });
});
