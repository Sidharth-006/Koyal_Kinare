import { describe, it, expect } from 'vitest';
import { InventoryService } from '@/modules/inventory/inventory.service';
import { ValidationError } from '@/shared/errors';

describe('Inventory Master Validation Unit Tests', () => {
  it('should reject blank or missing item name', async () => {
    await expect(
      InventoryService.createItem(
        { name: '', itemType: 'RAW_MATERIAL', baseUnit: 'KG', minimumStock: 10 },
        'admin-id'
      )
    ).rejects.toThrow(ValidationError);

    await expect(
      InventoryService.createItem(
        { name: '   ', itemType: 'RAW_MATERIAL', baseUnit: 'KG', minimumStock: 10 },
        'admin-id'
      )
    ).rejects.toThrow('Inventory item name is required.');
  });

  it('should reject overlength item name (>120 chars)', async () => {
    const longName = 'A'.repeat(121);
    await expect(
      InventoryService.createItem(
        { name: longName, itemType: 'RAW_MATERIAL', baseUnit: 'KG', minimumStock: 10 },
        'admin-id'
      )
    ).rejects.toThrow('Inventory item name cannot exceed 120 characters.');
  });

  it('should reject invalid item type', async () => {
    await expect(
      InventoryService.createItem(
        { name: 'Test Item', itemType: 'INVALID_TYPE' as any, baseUnit: 'KG', minimumStock: 10 },
        'admin-id'
      )
    ).rejects.toThrow('Invalid item type.');
  });

  it('should reject invalid base unit', async () => {
    await expect(
      InventoryService.createItem(
        { name: 'Test Item', itemType: 'RAW_MATERIAL', baseUnit: 'INVALID_UNIT' as any, minimumStock: 10 },
        'admin-id'
      )
    ).rejects.toThrow('Invalid base unit.');
  });

  it('should reject negative minimum stock', async () => {
    await expect(
      InventoryService.createItem(
        { name: 'Test Item', itemType: 'RAW_MATERIAL', baseUnit: 'KG', minimumStock: -5 },
        'admin-id'
      )
    ).rejects.toThrow('Minimum stock cannot be negative.');
  });

  it('should reject minimum stock with more than 3 decimal places', async () => {
    await expect(
      InventoryService.createItem(
        { name: 'Test Item', itemType: 'RAW_MATERIAL', baseUnit: 'KG', minimumStock: 1.2345 },
        'admin-id'
      )
    ).rejects.toThrow('Minimum stock cannot have more than 3 decimal places.');
  });

  it('should accept valid 3 decimal places minimum stock', async () => {
    // Should not throw validation error on precision 3
    const minStock = (InventoryService as any).validateMinimumStock('1.234');
    expect(minStock).toBe('1.234');
  });

  it('should reject description longer than 500 characters', async () => {
    const longDesc = 'D'.repeat(501);
    await expect(
      InventoryService.createItem(
        { name: 'Test Item', itemType: 'RAW_MATERIAL', baseUnit: 'KG', minimumStock: 10, description: longDesc },
        'admin-id'
      )
    ).rejects.toThrow('Description cannot exceed 500 characters.');
  });
});
