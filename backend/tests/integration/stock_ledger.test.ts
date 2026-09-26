import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Decimal from 'decimal.js';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { StockRepository } from '@/modules/stock/stock.repository';
import { InventoryRepository } from '@/modules/inventory/inventory.repository';
import { withTransaction, query, pool } from '@/shared/database/client';
import {
  InsufficientStockError,
  DuplicateOpeningStockError,
  DuplicateMovementError,
  ValidationError
} from '@/shared/errors';

describe('Stock Ledger Integration Tests', () => {
  let adminId: string;
  let testItemId: string;
  let archivedItemId: string;

  beforeAll(async () => {
    // Get existing admin or create test admin
    const adminRes = await query('SELECT id FROM admins LIMIT 1');
    if (adminRes.rows.length > 0) {
      adminId = adminRes.rows[0].id;
    } else {
      const inserted = await query(
        "INSERT INTO admins (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id",
        ['stock_test_admin@koyal.com', 'hashed_pass', 'Stock Test Admin']
      );
      adminId = inserted.rows[0].id;
    }

    // Create an active test inventory item
    const item = await InventoryRepository.create(
      {
        name: `Stock Test Item ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '10.000',
        description: 'For stock ledger integration tests'
      },
      adminId
    );
    testItemId = item.id;

    // Create an archived inventory item
    const archived = await InventoryRepository.create(
      {
        name: `Archived Item ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'L',
        minimumStock: '5.000',
        description: 'Archived item for stock testing'
      },
      adminId
    );
    await InventoryRepository.setArchiveStatus(archived.id, true, adminId);
    archivedItemId = archived.id;
  });

  afterAll(async () => {
    // Clean up created test data
    if (testItemId) {
      await query('DELETE FROM stock_movements WHERE inventory_item_id = $1', [testItemId]);
      await query('DELETE FROM stock_counts WHERE inventory_item_id = $1', [testItemId]);
      await query('DELETE FROM inventory_balances WHERE inventory_item_id = $1', [testItemId]);
      await query('DELETE FROM inventory_items WHERE id = $1', [testItemId]);
    }
    if (archivedItemId) {
      await query('DELETE FROM stock_movements WHERE inventory_item_id = $1', [archivedItemId]);
      await query('DELETE FROM inventory_balances WHERE inventory_item_id = $1', [archivedItemId]);
      await query('DELETE FROM inventory_items WHERE id = $1', [archivedItemId]);
    }
  });

  it('should initialize with 0 balance for a newly queried item', async () => {
    const summary = await StockLedgerService.getItemStock(testItemId);
    expect(summary.availableQuantity).toBe('0.000');
    expect(summary.isLowStock).toBe(true);
  });

  it('should record opening stock and update balance', async () => {
    const res = await StockLedgerService.recordOpeningStock(
      {
        inventoryItemId: testItemId,
        businessDate: '2026-09-26',
        quantity: 50.0,
        note: 'Initial opening stock'
      },
      adminId
    );

    expect(res.resultingBalance).toBe('50.000');
    expect(res.movement.movement_type).toBe('OPENING');
    expect(res.movement.quantity_delta).toBe('50.000');

    const summary = await StockLedgerService.getItemStock(testItemId);
    expect(summary.availableQuantity).toBe('50.000');
    expect(summary.isLowStock).toBe(false);
  });

  it('should reject duplicate opening stock for the same item on same date and source', async () => {
    await expect(
      StockLedgerService.recordOpeningStock(
        {
          inventoryItemId: testItemId,
          businessDate: '2026-09-26',
          quantity: 20.0
        },
        adminId
      )
    ).rejects.toThrow(DuplicateOpeningStockError);
  });

  it('should allow opening stock for the same item on a different business date or source', async () => {
    const multiItem = await InventoryRepository.create(
      {
        name: `Multi Opening Item ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '5.000',
        description: 'Testing opening on different date/source'
      },
      adminId
    );

    // Initial opening on date 2026-09-26 with default source
    const resInitial = await StockLedgerService.recordOpeningStock(
      {
        inventoryItemId: multiItem.id,
        businessDate: '2026-09-26',
        quantity: 10.0,
        note: 'Day 1 opening'
      },
      adminId
    );
    expect(resInitial.resultingBalance).toBe('10.000');

    // Duplicate on same date and same default source -> rejected
    await expect(
      StockLedgerService.recordOpeningStock(
        {
          inventoryItemId: multiItem.id,
          businessDate: '2026-09-26',
          quantity: 5.0
        },
        adminId
      )
    ).rejects.toThrow(DuplicateOpeningStockError);

    // Different business date -> allowed
    const resDate = await StockLedgerService.recordOpeningStock(
      {
        inventoryItemId: multiItem.id,
        businessDate: '2026-09-27',
        quantity: 15.0,
        note: 'Day 2 opening reconciliation'
      },
      adminId
    );
    expect(resDate.movement.movement_type).toBe('OPENING');
    expect(resDate.resultingBalance).toBe('25.000');

    // Different source on same business date -> allowed
    const resSource = await StockLedgerService.recordOpeningStock(
      {
        inventoryItemId: multiItem.id,
        businessDate: '2026-09-26',
        quantity: 5.0,
        sourceId: 'SOURCE_BATCH_B',
        note: 'Secondary warehouse opening'
      },
      adminId
    );
    expect(resSource.movement.movement_type).toBe('OPENING');
    expect(resSource.resultingBalance).toBe('30.000');

    // Cleanup
    await query('DELETE FROM stock_movements WHERE inventory_item_id = $1', [multiItem.id]);
    await query('DELETE FROM inventory_balances WHERE inventory_item_id = $1', [multiItem.id]);
    await query('DELETE FROM inventory_items WHERE id = $1', [multiItem.id]);
  }, 15000);

  it('should reject opening stock on archived item', async () => {
    await expect(
      StockLedgerService.recordOpeningStock(
        {
          inventoryItemId: archivedItemId,
          businessDate: '2026-09-26',
          quantity: 10.0
        },
        adminId
      )
    ).rejects.toThrow(ValidationError);
  });

  it('should record manual increase and update balance', async () => {
    const res = await StockLedgerService.recordAdjustment(
      {
        inventoryItemId: testItemId,
        type: 'MANUAL_INCREASE',
        quantity: 15.5,
        reason: 'Bonus supply received'
      },
      adminId
    );

    expect(res.resultingBalance).toBe('65.500');
    expect(res.movement.movement_type).toBe('MANUAL_INCREASE');
    expect(res.movement.quantity_delta).toBe('15.500');
  });

  it('should record manual decrease and reduce balance', async () => {
    const res = await StockLedgerService.recordAdjustment(
      {
        inventoryItemId: testItemId,
        type: 'MANUAL_DECREASE',
        quantity: 10.0,
        reason: 'Internal kitchen use'
      },
      adminId
    );

    expect(res.resultingBalance).toBe('55.500');
    expect(res.movement.quantity_delta).toBe('-10.000');
  });

  it('should record wastage with mandatory reason', async () => {
    const res = await StockLedgerService.recordAdjustment(
      {
        inventoryItemId: testItemId,
        type: 'WASTAGE',
        quantity: 5.5,
        reason: 'Spilled during morning prep'
      },
      adminId
    );

    expect(res.resultingBalance).toBe('50.000');
    expect(res.movement.movement_type).toBe('WASTAGE');
    expect(res.movement.quantity_delta).toBe('-5.500');
  });

  it('should record manual consumption', async () => {
    const res = await StockLedgerService.recordAdjustment(
      {
        inventoryItemId: testItemId,
        type: 'MANUAL_CONSUMPTION',
        quantity: 10.0,
        reason: 'Staff meal consumption'
      },
      adminId
    );

    expect(res.resultingBalance).toBe('40.000');
    expect(res.movement.movement_type).toBe('MANUAL_CONSUMPTION');
    expect(res.movement.quantity_delta).toBe('-10.000');
  });

  it('should reject reduction that would cause negative balance with INSUFFICIENT_STOCK', async () => {
    await expect(
      StockLedgerService.recordAdjustment(
        {
          inventoryItemId: testItemId,
          type: 'MANUAL_DECREASE',
          quantity: 100.0,
          reason: 'Excessive decrease'
        },
        adminId
      )
    ).rejects.toThrow(InsufficientStockError);

    // Verify balance was untouched
    const summary = await StockLedgerService.getItemStock(testItemId);
    expect(summary.availableQuantity).toBe('40.000');
  });

  it('should support idempotency replay for adjustments', async () => {
    const key = `test-stock-idemp-${Date.now()}`;
    const payload = {
      inventoryItemId: testItemId,
      type: 'MANUAL_INCREASE' as const,
      quantity: 5.0,
      reason: 'Idempotency test increase',
      idempotencyKey: key
    };

    const first = await StockLedgerService.recordAdjustment(payload, adminId);
    expect(first.resultingBalance).toBe('45.000');

    // Replay with identical key
    const second = await StockLedgerService.recordAdjustment(payload, adminId);
    expect(second.resultingBalance).toBe('45.000');
    expect(second.movement.id).toBe(first.movement.id);

    // Balance should have increased only once
    const summary = await StockLedgerService.getItemStock(testItemId);
    expect(summary.availableQuantity).toBe('45.000');
  });

  it('should verify sum of ledger deltas strictly matches inventory_balances', async () => {
    const sumDeltas = await StockRepository.getSumOfDeltas(testItemId);
    const balance = await StockRepository.getBalance(testItemId);
    expect(sumDeltas).toBe(balance?.available_quantity);
  });

  describe('Module 3 Integration Contract Simulation', () => {
    const purchaseLineId = `line-test-${Date.now()}`;

    it('should execute recordPurchaseReceipt inside caller transaction', async () => {
      const res = await withTransaction(async (client) => {
        return StockLedgerService.recordPurchaseReceipt(
          {
            purchaseId: 'test-purchase-uuid',
            purchaseNumber: 'KP-20260926-0001',
            purchaseLineId,
            inventoryItemId: testItemId,
            quantity: 20.0,
            unitCost: 75.5,
            adminId,
            businessDate: '2026-09-26'
          },
          client
        );
      });

      expect(res.quantityDelta).toBe('20.000');
      expect(res.resultingBalance).toBe('65.000');

      const summary = await StockLedgerService.getItemStock(testItemId);
      expect(summary.availableQuantity).toBe('65.000');
    });

    it('should reject duplicate machine receipt with same line reference', async () => {
      await expect(
        withTransaction(async (client) => {
          return StockLedgerService.recordPurchaseReceipt(
            {
              purchaseId: 'test-purchase-uuid',
              purchaseNumber: 'KP-20260926-0001',
              purchaseLineId,
              inventoryItemId: testItemId,
              quantity: 20.0,
              unitCost: 75.5,
              adminId,
              businessDate: '2026-09-26'
            },
            client
          );
        })
      ).rejects.toThrow(DuplicateMovementError);
    });

    it('should execute recordPurchaseReversal inside caller transaction', async () => {
      const reversalLineId = `line-reversal-${Date.now()}`;
      const res = await withTransaction(async (client) => {
        return StockLedgerService.recordPurchaseReversal(
          {
            purchaseId: 'test-purchase-uuid',
            purchaseNumber: 'KP-20260926-0001',
            purchaseLineId: reversalLineId,
            inventoryItemId: testItemId,
            quantity: 10.0,
            reason: 'Returned defective batch to supplier',
            adminId,
            businessDate: '2026-09-26'
          },
          client
        );
      });

      expect(res.quantityDelta).toBe('-10.000');
      expect(res.resultingBalance).toBe('55.000');
    });

    it('should completely roll back stock movements and balance if outer transaction aborts', async () => {
      const balanceBefore = (await StockLedgerService.getItemStock(testItemId)).availableQuantity;
      const uncommittedLineId = `uncommitted-line-${Date.now()}`;

      await expect(
        withTransaction(async (client) => {
          await StockLedgerService.recordPurchaseReceipt(
            {
              purchaseId: 'test-fail-purchase',
              purchaseNumber: 'KP-20260926-9999',
              purchaseLineId: uncommittedLineId,
              inventoryItemId: testItemId,
              quantity: 50.0,
              unitCost: 100,
              adminId,
              businessDate: '2026-09-26'
            },
            client
          );

          // Force transaction failure
          throw new Error('Simulated Module 3 post-stock database failure');
        })
      ).rejects.toThrow('Simulated Module 3 post-stock database failure');

      // Verify balance did NOT change
      const balanceAfter = (await StockLedgerService.getItemStock(testItemId)).availableQuantity;
      expect(balanceAfter).toBe(balanceBefore);

      // Verify movement was NOT persisted
      const exists = await StockRepository.hasMachineMovement('PURCHASE_RECEIPT', uncommittedLineId);
      expect(exists).toBe(false);
    });

    it('should allow purchase reversal when the inventory item was subsequently archived', async () => {
      // 1. Create a fresh item
      const itemToArchive = await InventoryRepository.create(
        {
          name: `Reversal After Archive Item ${Date.now()}`,
          itemType: 'RAW_MATERIAL',
          baseUnit: 'KG',
          minimumStock: '5.000',
          description: 'Testing reversal after archive'
        },
        adminId
      );

      const receiptLineId = `receipt-line-archive-${Date.now()}`;
      const reversalLineId = `reversal-line-archive-${Date.now()}`;

      // 2. Perform/simulate purchase receipt
      await withTransaction(async (client) => {
        return StockLedgerService.recordPurchaseReceipt(
          {
            purchaseId: 'purchase-before-archive',
            purchaseNumber: 'KP-20260926-0002',
            purchaseLineId: receiptLineId,
            inventoryItemId: itemToArchive.id,
            quantity: 25.0,
            unitCost: 50.0,
            adminId,
            businessDate: '2026-09-26'
          },
          client
        );
      });

      const balanceAfterReceipt = await StockRepository.getBalance(itemToArchive.id);
      expect(balanceAfterReceipt?.available_quantity).toBe('25.000');

      // 3. Archive the inventory item
      await InventoryRepository.setArchiveStatus(itemToArchive.id, true, adminId);
      const archivedItem = await InventoryRepository.findById(itemToArchive.id);
      expect(archivedItem?.is_archived).toBe(true);

      // 4. Perform purchase reversal on the archived item
      const reversalRes = await withTransaction(async (client) => {
        return StockLedgerService.recordPurchaseReversal(
          {
            purchaseId: 'purchase-before-archive',
            purchaseNumber: 'KP-20260926-0002',
            purchaseLineId: reversalLineId,
            inventoryItemId: itemToArchive.id,
            quantity: 25.0,
            reason: 'Reversing received purchase for archived discontinued item',
            adminId,
            businessDate: '2026-09-26'
          },
          client
        );
      });

      // 5. Verify reversal succeeds and ledger/balance are correct
      expect(reversalRes.quantityDelta).toBe('-25.000');
      expect(reversalRes.resultingBalance).toBe('0.000');

      const balanceAfterReversal = await StockRepository.getBalance(itemToArchive.id);
      expect(balanceAfterReversal?.available_quantity).toBe('0.000');

      const sumDeltas = await StockRepository.getSumOfDeltas(itemToArchive.id);
      expect(sumDeltas).toBe('0.000');

      // Cleanup
      await query('DELETE FROM stock_movements WHERE inventory_item_id = $1', [itemToArchive.id]);
      await query('DELETE FROM inventory_balances WHERE inventory_item_id = $1', [itemToArchive.id]);
      await query('DELETE FROM inventory_items WHERE id = $1', [itemToArchive.id]);
    });
  });

  describe('Concurrency & Serialization Tests', () => {
    it(
      'should handle concurrent first-ever movements on a brand-new item with no initial balance row',
      async () => {
        // Create brand-new item
        const freshItem = await InventoryRepository.create(
          {
            name: `Fresh Concurrency Item ${Date.now()}`,
            itemType: 'RAW_MATERIAL',
            baseUnit: 'KG',
            minimumStock: '5.000',
            description: 'Testing first-ever concurrent balance insertion'
          },
          adminId
        );

        // Verify NO row exists in inventory_balances initially
        const checkBefore = await query('SELECT * FROM inventory_balances WHERE inventory_item_id = $1', [freshItem.id]);
        expect(checkBefore.rows.length).toBe(0);

        // Fire two concurrent first-ever movements
        const [resA, resB] = await Promise.all([
          StockLedgerService.recordAdjustment(
            { inventoryItemId: freshItem.id, type: 'MANUAL_INCREASE', quantity: 10.0, reason: 'First move A' },
            adminId
          ),
          StockLedgerService.recordAdjustment(
            { inventoryItemId: freshItem.id, type: 'MANUAL_INCREASE', quantity: 15.0, reason: 'First move B' },
            adminId
          )
        ]);

        // Verify no deadlock, both succeeded
        expect(resA.movement.id).toBeDefined();
        expect(resB.movement.id).toBeDefined();

        // Exactly one balance row exists in inventory_balances
        const checkAfter = await query('SELECT * FROM inventory_balances WHERE inventory_item_id = $1', [freshItem.id]);
        expect(checkAfter.rows.length).toBe(1);

        // Final available_quantity strictly equals SUM(quantity_delta) = 25.000
        expect(checkAfter.rows[0].available_quantity).toBe('25.000');
        const sumDeltas = await StockRepository.getSumOfDeltas(freshItem.id);
        expect(sumDeltas).toBe('25.000');

        // Cleanup
        await query('DELETE FROM stock_movements WHERE inventory_item_id = $1', [freshItem.id]);
        await query('DELETE FROM inventory_balances WHERE inventory_item_id = $1', [freshItem.id]);
        await query('DELETE FROM inventory_items WHERE id = $1', [freshItem.id]);
      },
      25000
    );

    it(
      'should serialize 10 concurrent adjustments on the same item without balance drift',
      async () => {
        const initialBalance = new Decimal((await StockLedgerService.getItemStock(testItemId)).availableQuantity);

        // 5 increases of 2.000 (+10.000) and 5 decreases of 1.000 (-5.000) -> Net +5.000
        const tasks = [
          ...Array(5).fill(null).map((_, i) =>
            StockLedgerService.recordAdjustment(
              { inventoryItemId: testItemId, type: 'MANUAL_INCREASE', quantity: 2.0, reason: `Conc Inc ${i}` },
              adminId
            )
          ),
          ...Array(5).fill(null).map((_, i) =>
            StockLedgerService.recordAdjustment(
              { inventoryItemId: testItemId, type: 'MANUAL_DECREASE', quantity: 1.0, reason: `Conc Dec ${i}` },
              adminId
            )
          )
        ];

        await Promise.all(tasks);

        const finalBalance = new Decimal((await StockLedgerService.getItemStock(testItemId)).availableQuantity);
        expect(finalBalance.toFixed(3)).toBe(initialBalance.plus(5).toFixed(3));

        // Sum of all deltas in DB must strictly match the final balance
        const sumDeltas = await StockRepository.getSumOfDeltas(testItemId);
        expect(sumDeltas).toBe(finalBalance.toFixed(3));
      },
      25000
    );
  });
});
