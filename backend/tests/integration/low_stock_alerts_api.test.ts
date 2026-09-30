import { describe, it, expect, beforeAll } from 'vitest';
import { InventoryAlertsService } from '@/modules/inventory/inventory-alerts.service';
import { InventoryRepository } from '@/modules/inventory/inventory.repository';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { query } from '@/shared/database/client';
import {
  ItemNotLowStockError,
  InventoryItemArchivedError,
  NotFoundError
} from '@/shared/errors';

describe('Low-Stock Alerts & Acknowledgement Integration Tests', () => {
  let adminId: string;
  let lowStockItem: any;
  let adequateStockItem: any;
  let boundaryItem: any;
  let archivedLowStockItem: any;

  beforeAll(async () => {
    const adminRes = await query('SELECT id FROM admins LIMIT 1');
    if (adminRes.rows.length > 0) {
      adminId = adminRes.rows[0].id;
    } else {
      const inserted = await query(
        "INSERT INTO admins (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id",
        ['lowstock_admin@koyal.com', 'hash', 'Low Stock Admin']
      );
      adminId = inserted.rows[0].id;
    }

    // 1. Create item with zero stock (minimum 10) -> LOW STOCK
    lowStockItem = await InventoryRepository.create(
      {
        name: `Alert Test Item Low ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '10.000'
      },
      adminId
    );

    // 2. Create item with stock == minimum (5.000) -> LOW STOCK BOUNDARY
    boundaryItem = await InventoryRepository.create(
      {
        name: `Alert Test Item Boundary ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'L',
        minimumStock: '5.000'
      },
      adminId
    );
    await StockLedgerService.recordOpeningStock(
      {
        inventoryItemId: boundaryItem.id,
        businessDate: '2026-09-01',
        quantity: '5.000',
        unitCost: '40.00'
      },
      adminId
    );

    // 3. Create item with stock > minimum (15.000 > 5.000) -> ADEQUATE STOCK
    adequateStockItem = await InventoryRepository.create(
      {
        name: `Alert Test Item Adequate ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '5.000'
      },
      adminId
    );
    await StockLedgerService.recordOpeningStock(
      {
        inventoryItemId: adequateStockItem.id,
        businessDate: '2026-09-01',
        quantity: '15.000',
        unitCost: '50.00'
      },
      adminId
    );

    // 4. Create archived item with zero stock -> MUST BE EXCLUDED
    archivedLowStockItem = await InventoryRepository.create(
      {
        name: `Alert Test Item Archived ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '10.000'
      },
      adminId
    );
    await InventoryRepository.setArchiveStatus(archivedLowStockItem.id, true, adminId);
  });

  it('should list low-stock items and boundary items, excluding adequate stock and archived items', async () => {
    const res = await InventoryAlertsService.getLowStock(1, 100);

    const ids = res.items.map((i: any) => i.id);

    // Low stock and boundary items must be in list
    expect(ids).toContain(lowStockItem.id);
    expect(ids).toContain(boundaryItem.id);

    // Adequate stock item must NOT be in list
    expect(ids).not.toContain(adequateStockItem.id);

    // Archived item must NOT be in list
    expect(ids).not.toContain(archivedLowStockItem.id);
  });

  it('should successfully acknowledge a low stock alert and capture balance snapshot', async () => {
    const ack = await InventoryAlertsService.acknowledgeAlert(
      lowStockItem.id,
      'Order has been placed with supplier',
      adminId
    );

    expect(ack).toBeDefined();
    expect(ack.inventoryItemId).toBe(lowStockItem.id);
    expect(ack.balanceSnapshot).toBe('0.000');
    expect(ack.note).toBe('Order has been placed with supplier');
    expect(ack.acknowledgedBy).toBe(adminId);

    // Check audit log
    const auditRes = await query(
      "SELECT * FROM audit_logs WHERE action = 'LOW_STOCK_ACKNOWLEDGED' AND entity_id = $1",
      [lowStockItem.id]
    );
    expect(auditRes.rows.length).toBeGreaterThan(0);
  });

  it('should NOT suppress an active low-stock alert after acknowledgement', async () => {
    const res = await InventoryAlertsService.getLowStock(1, 100);
    const item = res.items.find((i: any) => i.id === lowStockItem.id);

    expect(item).toBeDefined();
    expect(item?.latestAcknowledgement).toBeDefined();
    expect(item?.latestAcknowledgement?.note).toBe('Order has been placed with supplier');
  });

  it('should reject acknowledgement when item is NOT currently low stock', async () => {
    await expect(
      InventoryAlertsService.acknowledgeAlert(adequateStockItem.id, 'Test note', adminId)
    ).rejects.toThrow(ItemNotLowStockError);
  });

  it('should reject acknowledgement when item is archived', async () => {
    await expect(
      InventoryAlertsService.acknowledgeAlert(archivedLowStockItem.id, 'Test note', adminId)
    ).rejects.toThrow(InventoryItemArchivedError);
  });

  it('should reject acknowledgement when item does not exist', async () => {
    await expect(
      InventoryAlertsService.acknowledgeAlert('00000000-0000-0000-0000-000000000000', 'Test note', adminId)
    ).rejects.toThrow(NotFoundError);
  });
});
