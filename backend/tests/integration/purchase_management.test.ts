import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query } from '@/shared/database/client';
import { PurchaseService } from '@/modules/purchases/purchases.service';
import { PurchaseRepository } from '@/modules/purchases/purchases.repository';
import { SupplierRepository } from '@/modules/supplier/supplier.repository';
import { InventoryRepository } from '@/modules/inventory/inventory.repository';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { ReconciliationService } from '@/modules/reconciliation/reconciliation.service';
import {
  ValidationError,
  NotFoundError,
  SupplierInactiveError,
  InventoryItemArchivedError,
  PurchaseNotEditableError,
  PurchaseAlreadyReceivedError,
  PurchaseAlreadyReversedError,
  PurchaseNotReversibleError,
  InsufficientStockError,
  IdempotencyError
} from '@/shared/errors';

describe('Purchase Management Integration Tests (Step 2)', { timeout: 25000 }, () => {
  let adminId: string;
  let testSupplierId: string;
  let archivedSupplierId: string;
  let testItemId1: string;
  let testItemId2: string;
  let archivedItemId: string;

  beforeAll(async () => {
    // 1. Get or create test admin
    const { rows: adminRows } = await query("SELECT id FROM admins WHERE email = 'admin@koyal.com'");
    if (adminRows.length > 0) {
      adminId = adminRows[0].id;
    } else {
      const { rows: newAdmin } = await query(`
        INSERT INTO admins (email, password_hash, display_name, is_active)
        VALUES ('admin@koyal.com', 'dummyhash', 'Test Admin', true)
        RETURNING id;
      `);
      adminId = newAdmin[0].id;
    }

    // 2. Create Active Supplier
    const supplier1 = await SupplierRepository.create(
      {
        name: `Active Supplier ${Date.now()}`,
        contactPerson: 'Ramesh',
        phone: '9876543210'
      },
      adminId
    );
    testSupplierId = supplier1.id;

    // 3. Create Archived Supplier
    const supplier2 = await SupplierRepository.create(
      {
        name: `Archived Supplier ${Date.now()}`,
        contactPerson: 'Suresh'
      },
      adminId
    );
    await SupplierRepository.setArchiveStatus(supplier2.id, true, adminId);
    archivedSupplierId = supplier2.id;

    // 4. Create Active Inventory Items
    const item1 = await InventoryRepository.create(
      {
        name: `Purchase Item A ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '5.000'
      },
      adminId
    );
    testItemId1 = item1.id;

    const item2 = await InventoryRepository.create(
      {
        name: `Purchase Item B ${Date.now()}`,
        itemType: 'PACKAGING',
        baseUnit: 'BOX',
        minimumStock: '2.000'
      },
      adminId
    );
    testItemId2 = item2.id;

    // 5. Create Item to Archive
    const item3 = await InventoryRepository.create(
      {
        name: `Purchase Item C ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'L',
        minimumStock: '1.000'
      },
      adminId
    );
    await InventoryRepository.setArchiveStatus(item3.id, true, adminId);
    archivedItemId = item3.id;
  });

  afterAll(async () => {
    // Cleanup created test records in strict foreign-key order
    await query('DELETE FROM purchase_reversals WHERE purchase_id IN (SELECT id FROM purchases WHERE created_by = $1)', [adminId]);
    await query('DELETE FROM purchase_lines WHERE purchase_id IN (SELECT id FROM purchases WHERE created_by = $1)', [adminId]);
    await query('DELETE FROM purchases WHERE created_by = $1', [adminId]);
    await query('DELETE FROM stock_movements WHERE inventory_item_id IN ($1, $2, $3)', [testItemId1, testItemId2, archivedItemId]);
    await query('DELETE FROM inventory_balances WHERE inventory_item_id IN ($1, $2, $3)', [testItemId1, testItemId2, archivedItemId]);
    await query('DELETE FROM inventory_items WHERE id IN ($1, $2, $3)', [testItemId1, testItemId2, archivedItemId]);
    await query('DELETE FROM suppliers WHERE id IN ($1, $2)', [testSupplierId, archivedSupplierId]);
  });

  // -------------------------------------------------------------
  // DRAFT CREATION
  // -------------------------------------------------------------
  describe('Draft Creation', () => {
    it('1. should create a valid purchase draft with regular active supplier', async () => {
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          invoiceNumber: 'INV-101',
          discount: 10,
          taxAmount: 5,
          lines: [
            {
              inventoryItemId: testItemId1,
              quantity: 10,
              unitRate: 100,
              lineDiscount: 50,
              taxRate: 5
            }
          ]
        },
        adminId
      );

      expect(draft.id).toBeDefined();
      expect(draft.purchase_number).toMatch(/^KP-20260926-\d{4}$/);
      expect(draft.status).toBe('DRAFT');
      expect(draft.supplier_id).toBe(testSupplierId);
      expect(draft.supplier_name).toBeDefined();
      expect(draft.lines).toHaveLength(1);
      // Line: qty 10 * 100 = 1000 - 50 = 950 * 1.05 = 997.50
      expect(draft.lines![0].line_total).toBe('997.50');
      // Grand total: 997.50 - 10 + 5 = 992.50
      expect(draft.grand_total).toBe('992.50');
    });

    it('2. should create an ad-hoc supplier purchase draft', async () => {
      const draft = await PurchaseService.createDraft(
        {
          adhocSupplierName: '  Local Mandi Vendor  ',
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [
            {
              inventoryItemId: testItemId1,
              quantity: 2,
              unitRate: 50
            }
          ]
        },
        adminId
      );

      expect(draft.supplier_id).toBeNull();
      expect(draft.supplier_name).toBe('Local Mandi Vendor');
      expect(draft.grand_total).toBe('100.00');
    });

    it('3. should reject creation with archived supplier', async () => {
      await expect(
        PurchaseService.createDraft(
          {
            supplierId: archivedSupplierId,
            purchaseDate: '2026-09-26',
            paymentMethod: 'CASH',
            lines: [{ inventoryItemId: testItemId1, quantity: 1, unitRate: 50 }]
          },
          adminId
        )
      ).rejects.toThrow(SupplierInactiveError);
    });

    it('4. should reject creation with archived inventory item', async () => {
      await expect(
        PurchaseService.createDraft(
          {
            supplierId: testSupplierId,
            purchaseDate: '2026-09-26',
            paymentMethod: 'CASH',
            lines: [{ inventoryItemId: archivedItemId, quantity: 1, unitRate: 50 }]
          },
          adminId
        )
      ).rejects.toThrow(InventoryItemArchivedError);
    });

    it('5. should reject empty lines', async () => {
      await expect(
        PurchaseService.createDraft(
          {
            supplierId: testSupplierId,
            purchaseDate: '2026-09-26',
            paymentMethod: 'CASH',
            lines: []
          },
          adminId
        )
      ).rejects.toThrow(ValidationError);
    });

    it('6. should snapshot item name and unit server-side', async () => {
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'UPI',
          lines: [
            {
              inventoryItemId: testItemId2, // Packaging BOX
              quantity: 5,
              unitRate: 40
            }
          ]
        },
        adminId
      );

      expect(draft.lines![0].unit).toBe('BOX');
      expect(draft.lines![0].item_name).toContain('Purchase Item B');
    });
  });

  // -------------------------------------------------------------
  // DRAFT EDITING
  // -------------------------------------------------------------
  describe('Draft Editing', () => {
    it('7. should allow editing a DRAFT purchase and recalculate totals', async () => {
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId1, quantity: 2, unitRate: 100 }]
        },
        adminId
      );
      expect(draft.grand_total).toBe('200.00');

      const updated = await PurchaseService.updateDraft(
        draft.id,
        {
          discount: 20,
          lines: [{ inventoryItemId: testItemId1, quantity: 3, unitRate: 100 }]
        },
        adminId
      );

      expect(updated.lines).toHaveLength(1);
      expect(updated.lines![0].quantity).toBe('3.000');
      // Subtotal 300 - 20 = 280
      expect(updated.grand_total).toBe('280.00');
    });
  });

  // -------------------------------------------------------------
  // RECEIVE PURCHASE
  // -------------------------------------------------------------
  describe('Receive Purchase', () => {
    it('8. should atomically receive purchase, update stock, and be idempotent', async () => {
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [
            { inventoryItemId: testItemId1, quantity: 15, unitRate: 80 },
            { inventoryItemId: testItemId2, quantity: 10, unitRate: 50 }
          ]
        },
        adminId
      );

      const idempotencyKey = `idemp-receive-${Date.now()}`;

      // Execute receive
      const received = await PurchaseService.receivePurchase(draft.id, adminId, idempotencyKey);
      expect(received.status).toBe('RECEIVED');
      expect(received.received_at).toBeDefined();

      // Check Module 4 balances
      const stock1 = await StockLedgerService.getItemStock(testItemId1);
      expect(Number(stock1.availableQuantity)).toBeGreaterThanOrEqual(15);

      const stock2 = await StockLedgerService.getItemStock(testItemId2);
      expect(Number(stock2.availableQuantity)).toBeGreaterThanOrEqual(10);

      // Replay with SAME idempotency key -> returns cached response
      const replayed = await PurchaseService.receivePurchase(draft.id, adminId, idempotencyKey);
      expect(replayed.id).toBe(received.id);
      expect(replayed.status).toBe('RECEIVED');

      // Attempt to receive again with DIFFERENT idempotency key -> throws PURCHASE_ALREADY_RECEIVED
      await expect(
        PurchaseService.receivePurchase(draft.id, adminId, `different-key-${Date.now()}`)
      ).rejects.toThrow(PurchaseAlreadyReceivedError);
    });

    it('9. should reject editing a RECEIVED purchase', async () => {
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId1, quantity: 2, unitRate: 10 }]
        },
        adminId
      );

      await PurchaseService.receivePurchase(draft.id, adminId, `recv-${Date.now()}`);

      await expect(
        PurchaseService.updateDraft(draft.id, { discount: 5 }, adminId)
      ).rejects.toThrow(PurchaseNotEditableError);
    });
  });

  // -------------------------------------------------------------
  // REVERSE PURCHASE
  // -------------------------------------------------------------
  describe('Reverse Purchase', () => {
    it('10. should reverse a RECEIVED purchase, create compensating movements, and record reversal', async () => {
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId1, quantity: 4, unitRate: 50 }]
        },
        adminId
      );

      await PurchaseService.receivePurchase(draft.id, adminId, `recv-${Date.now()}`);
      const stockBeforeReversal = await StockLedgerService.getItemStock(testItemId1);

      const reverseKey = `rev-key-${Date.now()}`;
      const reversed = await PurchaseService.reversePurchase(
        draft.id,
        'Damaged packaging upon delivery',
        adminId,
        reverseKey
      );

      expect(reversed.status).toBe('REVERSED');
      expect(reversed.reversal).toBeDefined();
      expect(reversed.reversal?.reason).toBe('Damaged packaging upon delivery');

      // Balance reduced by 4
      const stockAfterReversal = await StockLedgerService.getItemStock(testItemId1);
      expect(Number(stockAfterReversal.availableQuantity)).toBe(Number(stockBeforeReversal.availableQuantity) - 4);

      // Replay reversal is idempotent
      const replayReversal = await PurchaseService.reversePurchase(
        draft.id,
        'Damaged packaging upon delivery',
        adminId,
        reverseKey
      );
      expect(replayReversal.status).toBe('REVERSED');

      // Second reversal with new key -> rejected
      await expect(
        PurchaseService.reversePurchase(draft.id, 'Another reason', adminId, `rev-new-${Date.now()}`)
      ).rejects.toThrow(PurchaseAlreadyReversedError);
    });

    it('11. should reject reversal if reason is less than 5 characters', async () => {
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId1, quantity: 1, unitRate: 50 }]
        },
        adminId
      );
      await PurchaseService.receivePurchase(draft.id, adminId, `recv-${Date.now()}`);

      await expect(
        PurchaseService.reversePurchase(draft.id, 'Bad', adminId, `rev-${Date.now()}`)
      ).rejects.toThrow(ValidationError);
    });

    it('12. should reject reversing a DRAFT purchase', async () => {
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId1, quantity: 1, unitRate: 50 }]
        },
        adminId
      );

      await expect(
        PurchaseService.reversePurchase(draft.id, 'Valid reversal reason', adminId, `rev-${Date.now()}`)
      ).rejects.toThrow(PurchaseNotReversibleError);
    });

    it('13. should reject reversal if stock has been consumed and would become negative', async () => {
      // Create dedicated single-item to test negative stock constraint
      const singleItem = await InventoryRepository.create(
        {
          name: `Depleted Item ${Date.now()}`,
          itemType: 'RAW_MATERIAL',
          baseUnit: 'KG',
          minimumStock: '0.000'
        },
        adminId
      );

      // Purchase 10 KG
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: singleItem.id, quantity: 10, unitRate: 100 }]
        },
        adminId
      );
      await PurchaseService.receivePurchase(draft.id, adminId, `recv-dep-${Date.now()}`);

      // Consume 8 KG (leaving only 2 KG)
      await StockLedgerService.recordAdjustment(
        {
          inventoryItemId: singleItem.id,
          type: 'MANUAL_CONSUMPTION',
          quantity: 8,
          reason: 'Kitchen prep consumption'
        },
        adminId
      );

      // Attempting to reverse 10 KG purchase must fail with InsufficientStockError
      await expect(
        PurchaseService.reversePurchase(draft.id, 'Return entire 10kg batch', adminId, `rev-dep-${Date.now()}`)
      ).rejects.toThrow(InsufficientStockError);

      // Purchase must still be in RECEIVED status (no partial state)
      const afterFailedReversal = await PurchaseService.getById(draft.id);
      expect(afterFailedReversal.status).toBe('RECEIVED');

      // Clean up item
      await query('DELETE FROM purchase_lines WHERE purchase_id = $1', [draft.id]);
      await query('DELETE FROM purchases WHERE id = $1', [draft.id]);
      await query('DELETE FROM stock_movements WHERE inventory_item_id = $1', [singleItem.id]);
      await query('DELETE FROM inventory_balances WHERE inventory_item_id = $1', [singleItem.id]);
      await query('DELETE FROM inventory_items WHERE id = $1', [singleItem.id]);
    });

    it('14. should allow purchase reversal even when inventory item was archived after receiving', async () => {
      const archivableItem = await InventoryRepository.create(
        {
          name: `Archived Post Receipt ${Date.now()}`,
          itemType: 'RAW_MATERIAL',
          baseUnit: 'KG',
          minimumStock: '0.000'
        },
        adminId
      );

      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: archivableItem.id, quantity: 5, unitRate: 10 }]
        },
        adminId
      );
      await PurchaseService.receivePurchase(draft.id, adminId, `recv-arch-${Date.now()}`);

      // Now archive the inventory item
      await InventoryRepository.setArchiveStatus(archivableItem.id, true, adminId);

      // Reversing should succeed despite item being archived
      const reversed = await PurchaseService.reversePurchase(
        draft.id,
        'Returning defective stock of discontinued item',
        adminId,
        `rev-arch-${Date.now()}`
      );
      expect(reversed.status).toBe('REVERSED');

      // Clean up
      await query('DELETE FROM purchase_reversals WHERE purchase_id = $1', [draft.id]);
      await query('DELETE FROM purchase_lines WHERE purchase_id = $1', [draft.id]);
      await query('DELETE FROM purchases WHERE id = $1', [draft.id]);
      await query('DELETE FROM stock_movements WHERE inventory_item_id = $1', [archivableItem.id]);
      await query('DELETE FROM inventory_balances WHERE inventory_item_id = $1', [archivableItem.id]);
      await query('DELETE FROM inventory_items WHERE id = $1', [archivableItem.id]);
    });
  });

  // -------------------------------------------------------------
  // RECONCILIATION INTEGRATION
  // -------------------------------------------------------------
  describe('Reconciliation Integration', () => {
    const reconDate = '2026-10-15';

    beforeAll(async () => {
      await query('DELETE FROM purchase_reversals WHERE purchase_id IN (SELECT id FROM purchases WHERE purchase_date = $1)', [reconDate]);
      await query('DELETE FROM purchase_lines WHERE purchase_id IN (SELECT id FROM purchases WHERE purchase_date = $1)', [reconDate]);
      await query('DELETE FROM purchases WHERE purchase_date = $1', [reconDate]);
      await query('DELETE FROM cash_openings WHERE business_date = $1', [reconDate]);
      await ReconciliationService.setOpeningCash(reconDate, 1000.0, adminId);
    });

    afterAll(async () => {
      await query('DELETE FROM purchase_reversals WHERE purchase_id IN (SELECT id FROM purchases WHERE purchase_date = $1)', [reconDate]);
      await query('DELETE FROM purchase_lines WHERE purchase_id IN (SELECT id FROM purchases WHERE purchase_date = $1)', [reconDate]);
      await query('DELETE FROM purchases WHERE purchase_date = $1', [reconDate]);
      await query('DELETE FROM cash_openings WHERE business_date = $1', [reconDate]);
    });

    it('15. CASH received purchase reduces expected cash drawer balance', async () => {
      const previewBefore = await ReconciliationService.getReconciliationPreview(reconDate);
      expect(previewBefore.expectedClosingCash).toBe('1000.00');

      // Create & receive cash purchase of 250
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: reconDate,
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId1, quantity: 5, unitRate: 50 }]
        },
        adminId
      );
      await PurchaseService.receivePurchase(draft.id, adminId, `recon-cash-${Date.now()}`);

      const previewAfter = await ReconciliationService.getReconciliationPreview(reconDate);
      expect(previewAfter.cashPurchases).toBe('250.00');
      // 1000 - 250 = 750
      expect(previewAfter.expectedClosingCash).toBe('750.00');
    });

    it('16. UPI / CARD / CREDIT purchases do not alter expected cash drawer balance', async () => {
      const previewBefore = await ReconciliationService.getReconciliationPreview(reconDate);
      const startingExpected = previewBefore.expectedClosingCash;

      // UPI purchase
      const upiDraft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: reconDate,
          paymentMethod: 'UPI',
          lines: [{ inventoryItemId: testItemId1, quantity: 2, unitRate: 100 }]
        },
        adminId
      );
      await PurchaseService.receivePurchase(upiDraft.id, adminId, `recon-upi-${Date.now()}`);

      // Card purchase
      const cardDraft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: reconDate,
          paymentMethod: 'CARD',
          lines: [{ inventoryItemId: testItemId1, quantity: 2, unitRate: 100 }]
        },
        adminId
      );
      await PurchaseService.receivePurchase(cardDraft.id, adminId, `recon-card-${Date.now()}`);

      const previewAfter = await ReconciliationService.getReconciliationPreview(reconDate);
      expect(previewAfter.expectedClosingCash).toBe(startingExpected);
    });

    it('17. REVERSED cash purchase is excluded from cash purchase reconciliation', async () => {
      // Create cash purchase of 100
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: reconDate,
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId1, quantity: 1, unitRate: 100 }]
        },
        adminId
      );
      await PurchaseService.receivePurchase(draft.id, adminId, `recon-rev-in-${Date.now()}`);

      const previewWithReceived = await ReconciliationService.getReconciliationPreview(reconDate);

      // Now reverse this purchase
      await PurchaseService.reversePurchase(
        draft.id,
        'Accidental cash purchase reversed',
        adminId,
        `recon-rev-out-${Date.now()}`
      );

      const previewAfterReversal = await ReconciliationService.getReconciliationPreview(reconDate);
      // Expected cash restores back by 100
      expect(Number(previewAfterReversal.expectedClosingCash)).toBe(Number(previewWithReceived.expectedClosingCash) + 100);
    });
  });

  // -------------------------------------------------------------
  // CONCURRENCY & SERIALIZATION
  // -------------------------------------------------------------
  describe('Concurrency & Serialization Tests', () => {
    it('18. Two simultaneous receives on the same purchase: exactly one succeeds', async () => {
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId1, quantity: 3, unitRate: 10 }]
        },
        adminId
      );

      const keyA = `concurrent-recv-A-${Date.now()}`;
      const keyB = `concurrent-recv-B-${Date.now()}`;

      const results = await Promise.allSettled([
        PurchaseService.receivePurchase(draft.id, adminId, keyA),
        PurchaseService.receivePurchase(draft.id, adminId, keyB)
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const finalState = await PurchaseService.getById(draft.id);
      expect(finalState.status).toBe('RECEIVED');
    });

    it('19. Two simultaneous reversals on the same purchase: exactly one succeeds', async () => {
      const draft = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId1, quantity: 2, unitRate: 10 }]
        },
        adminId
      );

      await PurchaseService.receivePurchase(draft.id, adminId, `recv-for-rev-${Date.now()}`);

      const keyA = `concurrent-rev-A-${Date.now()}`;
      const keyB = `concurrent-rev-B-${Date.now()}`;

      const results = await Promise.allSettled([
        PurchaseService.reversePurchase(draft.id, 'Reason A for reversal', adminId, keyA),
        PurchaseService.reversePurchase(draft.id, 'Reason B for reversal', adminId, keyB)
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const finalState = await PurchaseService.getById(draft.id);
      expect(finalState.status).toBe('REVERSED');
    });
  });
});
