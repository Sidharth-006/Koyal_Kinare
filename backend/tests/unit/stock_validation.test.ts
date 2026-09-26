import { describe, it, expect } from 'vitest';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { ValidationError } from '@/shared/errors';

describe('Stock Ledger Validation Unit Tests', () => {
  it('should reject missing or blank quantity', async () => {
    await expect(
      StockLedgerService.recordOpeningStock(
        { inventoryItemId: 'item-1', quantity: '' as any },
        'admin-id'
      )
    ).rejects.toThrow(ValidationError);

    await expect(
      StockLedgerService.recordAdjustment(
        { inventoryItemId: 'item-1', type: 'MANUAL_INCREASE', quantity: null as any },
        'admin-id'
      )
    ).rejects.toThrow('Quantity is required.');
  });

  it('should reject zero or negative quantity for opening and adjustments', async () => {
    await expect(
      StockLedgerService.recordOpeningStock(
        { inventoryItemId: 'item-1', quantity: 0 },
        'admin-id'
      )
    ).rejects.toThrow('Quantity must be greater than zero.');

    await expect(
      StockLedgerService.recordOpeningStock(
        { inventoryItemId: 'item-1', quantity: -5 },
        'admin-id'
      )
    ).rejects.toThrow('Quantity must be greater than zero.');

    await expect(
      StockLedgerService.recordAdjustment(
        { inventoryItemId: 'item-1', type: 'MANUAL_INCREASE', quantity: -2 },
        'admin-id'
      )
    ).rejects.toThrow('Quantity must be greater than zero.');
  });

  it('should reject negative actual quantity for stock counts', async () => {
    await expect(
      StockLedgerService.recordStockCount(
        { inventoryItemId: 'item-1', actualQuantity: -1 },
        'admin-id'
      )
    ).rejects.toThrow('Quantity cannot be negative.');
  });

  it('should accept zero actual quantity for stock counts', async () => {
    const qty = (StockLedgerService as any).validateQuantity(0, true);
    expect(qty.toFixed(3)).toBe('0.000');
  });

  it('should reject quantity with more than 3 decimal places', async () => {
    await expect(
      StockLedgerService.recordOpeningStock(
        { inventoryItemId: 'item-1', quantity: 1.2345 },
        'admin-id'
      )
    ).rejects.toThrow('Quantity cannot have more than 3 decimal places.');

    await expect(
      StockLedgerService.recordAdjustment(
        { inventoryItemId: 'item-1', type: 'MANUAL_INCREASE', quantity: '10.5555' },
        'admin-id'
      )
    ).rejects.toThrow('Quantity cannot have more than 3 decimal places.');
  });

  it('should accept valid 3 decimal places', async () => {
    const qty = (StockLedgerService as any).validateQuantity('12.345');
    expect(qty.toFixed(3)).toBe('12.345');
  });

  it('should reject invalid adjustment type', async () => {
    await expect(
      StockLedgerService.recordAdjustment(
        { inventoryItemId: 'item-1', type: 'INVALID_TYPE' as any, quantity: 10 },
        'admin-id'
      )
    ).rejects.toThrow('Invalid adjustment type.');
  });

  it('should require non-empty reason for MANUAL_DECREASE, WASTAGE, and MANUAL_CONSUMPTION', async () => {
    await expect(
      StockLedgerService.recordAdjustment(
        { inventoryItemId: 'item-1', type: 'MANUAL_DECREASE', quantity: 5, reason: '' },
        'admin-id'
      )
    ).rejects.toThrow('A non-empty reason is mandatory for this adjustment.');

    await expect(
      StockLedgerService.recordAdjustment(
        { inventoryItemId: 'item-1', type: 'WASTAGE', quantity: 5, reason: '   ' },
        'admin-id'
      )
    ).rejects.toThrow('A non-empty reason is mandatory for this adjustment.');

    await expect(
      StockLedgerService.recordAdjustment(
        { inventoryItemId: 'item-1', type: 'MANUAL_CONSUMPTION', quantity: 5 },
        'admin-id'
      )
    ).rejects.toThrow('A non-empty reason is mandatory for this adjustment.');
  });

  it('should reject reason exceeding 500 characters', async () => {
    const longReason = 'A'.repeat(501);
    await expect(
      StockLedgerService.recordAdjustment(
        { inventoryItemId: 'item-1', type: 'WASTAGE', quantity: 5, reason: longReason },
        'admin-id'
      )
    ).rejects.toThrow('Reason cannot exceed 500 characters.');
  });
});
