import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { InventoryService } from '@/modules/inventory/inventory.service';
import { InventoryRepository } from '@/modules/inventory/inventory.repository';
import { DuplicateInventoryItemError, ItemHasStockHistoryError, ItemInUseError } from '@/shared/errors';
import { pool, query } from '@/shared/database/client';

describe('Inventory Master Integration Tests', () => {
  const testAdminId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    // Ensure test database is ready and clean test items
    await query(`
      INSERT INTO admins (id, email, password_hash, display_name)
      VALUES ($1, 'inventory_test@cafe.com', 'hash', 'Test Admin')
      ON CONFLICT (id) DO NOTHING;
    `, [testAdminId]);

    await query(`DELETE FROM inventory_items WHERE name LIKE 'TEST_%' OR name LIKE 'test_%';`);
  });

  afterAll(async () => {
    await query(`DELETE FROM inventory_items WHERE name LIKE 'TEST_%' OR name LIKE 'test_%';`);
  });

  it('should create a valid active inventory item', async () => {
    const item = await InventoryService.createItem(
      {
        name: 'TEST_Paneer_Raw',
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: 5.5,
        description: 'Fresh Cottage Cheese'
      },
      testAdminId
    );

    expect(item).toBeDefined();
    expect(item.id).toBeDefined();
    expect(item.name).toBe('TEST_Paneer_Raw');
    expect(item.item_type).toBe('RAW_MATERIAL');
    expect(item.base_unit).toBe('KG');
    expect(item.minimum_stock).toBe('5.500');
    expect(item.is_archived).toBe(false);
  });

  it('should reject creating duplicate active item name case-insensitively', async () => {
    await expect(
      InventoryService.createItem(
        {
          name: 'test_paneer_raw', // lowercase variation
          itemType: 'RAW_MATERIAL',
          baseUnit: 'KG',
          minimumStock: 10
        },
        testAdminId
      )
    ).rejects.toThrow(DuplicateInventoryItemError);
  });

  it('should read inventory item by ID', async () => {
    const created = await InventoryService.createItem(
      {
        name: 'TEST_Full_Milk',
        itemType: 'RAW_MATERIAL',
        baseUnit: 'L',
        minimumStock: 20
      },
      testAdminId
    );

    const fetched = await InventoryService.getItemById(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe('TEST_Full_Milk');
  });

  it('should list inventory items with search and pagination', async () => {
    const list = await InventoryService.listItems({
      search: 'TEST_Full_Milk',
      status: 'active',
      page: 1,
      pageSize: 10
    });

    expect(list.items.length).toBeGreaterThanOrEqual(1);
    expect(list.items[0].name).toBe('TEST_Full_Milk');
    expect(list.total).toBeGreaterThanOrEqual(1);
  });

  it('should update permitted inventory item fields', async () => {
    const created = await InventoryService.createItem(
      {
        name: 'TEST_Sugar_Bags',
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: 15
      },
      testAdminId
    );

    const updated = await InventoryService.updateItem(
      created.id,
      {
        description: 'Refined White Sugar',
        minimumStock: 25.0
      },
      testAdminId
    );

    expect(updated.description).toBe('Refined White Sugar');
    expect(updated.minimum_stock).toBe('25.000');
  });

  it('should allow base unit change when no stock history exists', async () => {
    const created = await InventoryService.createItem(
      {
        name: 'TEST_Tea_Leaves',
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: 2
      },
      testAdminId
    );

    const updated = await InventoryService.updateItem(
      created.id,
      { baseUnit: 'G' },
      testAdminId
    );

    expect(updated.base_unit).toBe('G');
  });

  it('should archive and restore an inventory item', async () => {
    const created = await InventoryService.createItem(
      {
        name: 'TEST_Paper_Cups',
        itemType: 'PACKAGING',
        baseUnit: 'PIECE',
        minimumStock: 100
      },
      testAdminId
    );

    // Archive
    const archived = await InventoryService.archiveItem(created.id, testAdminId);
    expect(archived.is_archived).toBe(true);

    // Now an item with the same name can be created because old one is archived
    const createdSameName = await InventoryService.createItem(
      {
        name: 'TEST_Paper_Cups',
        itemType: 'PACKAGING',
        baseUnit: 'PACKET',
        minimumStock: 50
      },
      testAdminId
    );
    expect(createdSameName.id).not.toBe(created.id);

    // Attempting to restore the archived one should fail due to active name conflict
    await expect(
      InventoryService.restoreItem(created.id, testAdminId)
    ).rejects.toThrow(DuplicateInventoryItemError);

    // Clean up second active item
    await InventoryService.archiveItem(createdSameName.id, testAdminId);

    // Now restore should succeed
    const restored = await InventoryService.restoreItem(created.id, testAdminId);
    expect(restored.is_archived).toBe(false);
  }, 15000);


  it('should handle idempotency key replay correctly', async () => {
    const idempotencyKey = `test-key-${Date.now()}`;
    const payload = {
      name: 'TEST_Idempotent_Item',
      itemType: 'BEVERAGE' as const,
      baseUnit: 'L' as const,
      minimumStock: 10,
      idempotencyKey
    };

    const first = await InventoryService.createItem(payload, testAdminId);
    const second = await InventoryService.createItem(payload, testAdminId);

    expect(second.id).toBe(first.id);
  });

  it('should create audit log entries for mutations', async () => {
    const created = await InventoryService.createItem(
      {
        name: 'TEST_Audited_Item',
        itemType: 'CONSUMABLE',
        baseUnit: 'BOX',
        minimumStock: 1
      },
      testAdminId
    );

    const { rows } = await query(
      `SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'INVENTORY_ITEM_CREATED'`,
      [created.id]
    );

    expect(rows.length).toBe(1);
    expect(rows[0].entity_type).toBe('INVENTORY_ITEM');
  });
});
