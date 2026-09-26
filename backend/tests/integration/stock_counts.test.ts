import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { StockRepository } from '@/modules/stock/stock.repository';
import { InventoryRepository } from '@/modules/inventory/inventory.repository';
import { query } from '@/shared/database/client';
import { ValidationError } from '@/shared/errors';

describe('Stock Counts Integration Tests', () => {
  let adminId: string;
  let testItemId: string;
  let archivedItemId: string;

  beforeAll(async () => {
    const adminRes = await query('SELECT id FROM admins LIMIT 1');
    if (adminRes.rows.length > 0) {
      adminId = adminRes.rows[0].id;
    } else {
      const inserted = await query(
        "INSERT INTO admins (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id",
        ['count_test_admin@koyal.com', 'hashed_pass', 'Count Test Admin']
      );
      adminId = inserted.rows[0].id;
    }

    const item = await InventoryRepository.create(
      {
        name: `Count Test Item ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '5.000',
        description: 'For physical stock count tests'
      },
      adminId
    );
    testItemId = item.id;

    const archived = await InventoryRepository.create(
      {
        name: `Count Archived Item ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '5.000',
        description: 'Archived item for count test'
      },
      adminId
    );
    await InventoryRepository.setArchiveStatus(archived.id, true, adminId);
    archivedItemId = archived.id;

    // Set initial balance via opening stock of 30.000
    await StockLedgerService.recordOpeningStock(
      {
        inventoryItemId: testItemId,
        businessDate: '2026-09-26',
        quantity: 30.0,
        note: 'Count baseline stock'
      },
      adminId
    );
  });

  afterAll(async () => {
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

  it('should record count with ZERO variance without creating a movement', async () => {
    const res = await StockLedgerService.recordStockCount(
      {
        inventoryItemId: testItemId,
        businessDate: '2026-09-26',
        actualQuantity: 30.0,
        reason: 'Daily closing match verification'
      },
      adminId
    );

    expect(res.movementCreated).toBe(false);
    expect(res.movement).toBeUndefined();
    expect(res.stockCount.expected_quantity).toBe('30.000');
    expect(res.stockCount.actual_quantity).toBe('30.000');
    expect(res.stockCount.variance_quantity).toBe('0.000');
    expect(res.resultingBalance).toBe('30.000');

    // Balance remains untouched
    const summary = await StockLedgerService.getItemStock(testItemId);
    expect(summary.availableQuantity).toBe('30.000');
  });

  it('should record count with NEGATIVE variance and apply COUNT_CORRECTION movement', async () => {
    // Current balance is 30.000, physical count reveals 27.500 (-2.500 shortage)
    const res = await StockLedgerService.recordStockCount(
      {
        inventoryItemId: testItemId,
        businessDate: '2026-09-26',
        actualQuantity: 27.5,
        reason: 'End-of-day discrepancy, small bag lost'
      },
      adminId
    );

    expect(res.movementCreated).toBe(true);
    expect(res.movement).toBeDefined();
    expect(res.movement?.movement_type).toBe('COUNT_CORRECTION');
    expect(res.movement?.quantity_delta).toBe('-2.500');
    expect(res.movement?.source_type).toBe('STOCK_COUNT');
    expect(res.movement?.source_id).toBe(res.stockCount.id);

    expect(res.stockCount.expected_quantity).toBe('30.000');
    expect(res.stockCount.actual_quantity).toBe('27.500');
    expect(res.stockCount.variance_quantity).toBe('-2.500');
    expect(res.resultingBalance).toBe('27.500');

    // Verify balance was updated
    const summary = await StockLedgerService.getItemStock(testItemId);
    expect(summary.availableQuantity).toBe('27.500');

    // Verify sum of deltas matches balance
    const sumDeltas = await StockRepository.getSumOfDeltas(testItemId);
    expect(sumDeltas).toBe('27.500');
  });

  it('should record count with POSITIVE variance and apply COUNT_CORRECTION movement', async () => {
    // Current balance is 27.500, physical count reveals 32.000 (+4.500 excess found)
    const res = await StockLedgerService.recordStockCount(
      {
        inventoryItemId: testItemId,
        businessDate: '2026-09-26',
        actualQuantity: 32.0,
        reason: 'Found misplaced stock in secondary storage'
      },
      adminId
    );

    expect(res.movementCreated).toBe(true);
    expect(res.movement?.movement_type).toBe('COUNT_CORRECTION');
    expect(res.movement?.quantity_delta).toBe('4.500');

    expect(res.stockCount.expected_quantity).toBe('27.500');
    expect(res.stockCount.actual_quantity).toBe('32.000');
    expect(res.stockCount.variance_quantity).toBe('4.500');
    expect(res.resultingBalance).toBe('32.000');

    const summary = await StockLedgerService.getItemStock(testItemId);
    expect(summary.availableQuantity).toBe('32.000');
  });

  it('should support counting down to 0 (complete stockout)', async () => {
    const res = await StockLedgerService.recordStockCount(
      {
        inventoryItemId: testItemId,
        businessDate: '2026-09-26',
        actualQuantity: 0,
        reason: 'Completely depleted'
      },
      adminId
    );

    expect(res.movementCreated).toBe(true);
    expect(res.movement?.quantity_delta).toBe('-32.000');
    expect(res.resultingBalance).toBe('0.000');

    const summary = await StockLedgerService.getItemStock(testItemId);
    expect(summary.availableQuantity).toBe('0.000');
    expect(summary.isLowStock).toBe(true);
  });

  it('should reject physical count on archived inventory item', async () => {
    await expect(
      StockLedgerService.recordStockCount(
        {
          inventoryItemId: archivedItemId,
          businessDate: '2026-09-26',
          actualQuantity: 10.0
        },
        adminId
      )
    ).rejects.toThrow(ValidationError);
  });
});
