import { describe, it, expect } from 'vitest';
import {
  calculatePurchaseLine,
  calculatePurchaseTotals,
  validateNonNegative,
  validatePositive
} from '@/modules/purchases/purchases.math';

describe('Purchase Math & Calculation Utilities', () => {
  describe('calculatePurchaseLine', () => {
    it('1. Simple line calculation without discount or tax', () => {
      const line = calculatePurchaseLine({
        inventoryItemId: 'item-1',
        quantity: 5,
        unitRate: 100
      });
      expect(line.quantity).toBe('5.000');
      expect(line.unitRate).toBe('100.00');
      expect(line.lineDiscount).toBe('0.00');
      expect(line.taxRate).toBe('0.00');
      expect(line.lineTotal).toBe('500.00');
    });

    it('2. Line with line discount', () => {
      const line = calculatePurchaseLine({
        inventoryItemId: 'item-1',
        quantity: 10,
        unitRate: 50,
        lineDiscount: 35
      });
      // Base: 500, Discounted: 465, Tax: 0 => 465.00
      expect(line.lineTotal).toBe('465.00');
    });

    it('3. Line with percentage tax', () => {
      const line = calculatePurchaseLine({
        inventoryItemId: 'item-1',
        quantity: 2,
        unitRate: 100,
        taxRate: 5 // 5% GST
      });
      // Base: 200, Tax: 10 => 210.00
      expect(line.lineTotal).toBe('210.00');
    });

    it('4. Line with discount + tax combined', () => {
      const line = calculatePurchaseLine({
        inventoryItemId: 'item-1',
        quantity: 10,
        unitRate: 100,
        lineDiscount: 100,
        taxRate: 18 // 18% GST
      });
      // Base: 1000, Discounted: 900, Tax: 900 * 0.18 = 162 => 1062.00
      expect(line.lineTotal).toBe('1062.00');
    });

    it('5. Line with zero tax rate', () => {
      const line = calculatePurchaseLine({
        inventoryItemId: 'item-1',
        quantity: 4,
        unitRate: 25.5,
        taxRate: 0
      });
      expect(line.lineTotal).toBe('102.00');
    });

    it('6. Line with zero unit rate (free sample / promotional item)', () => {
      const line = calculatePurchaseLine({
        inventoryItemId: 'item-1',
        quantity: 10,
        unitRate: 0,
        taxRate: 18
      });
      expect(line.lineTotal).toBe('0.00');
    });

    it('7. Rejects negative or zero quantity', () => {
      expect(() => {
        calculatePurchaseLine({
          inventoryItemId: 'item-1',
          quantity: 0,
          unitRate: 10
        });
      }).toThrow('Quantity must be greater than zero.');

      expect(() => {
        calculatePurchaseLine({
          inventoryItemId: 'item-1',
          quantity: -2,
          unitRate: 10
        });
      }).toThrow('Quantity must be greater than zero.');
    });

    it('8. Rejects negative unit rate, discount, or tax', () => {
      expect(() => {
        calculatePurchaseLine({
          inventoryItemId: 'item-1',
          quantity: 2,
          unitRate: -10
        });
      }).toThrow('Unit rate cannot be negative.');

      expect(() => {
        calculatePurchaseLine({
          inventoryItemId: 'item-1',
          quantity: 2,
          unitRate: 10,
          lineDiscount: -5
        });
      }).toThrow('Line discount cannot be negative.');

      expect(() => {
        calculatePurchaseLine({
          inventoryItemId: 'item-1',
          quantity: 2,
          unitRate: 10,
          taxRate: -1
        });
      }).toThrow('Tax rate cannot be negative.');
    });

    it('9. Line discount exceeding base value is capped at base (discountedLine = 0)', () => {
      const line = calculatePurchaseLine({
        inventoryItemId: 'item-1',
        quantity: 2,
        unitRate: 10,
        lineDiscount: 50, // Base is 20
        taxRate: 18
      });
      expect(line.lineTotal).toBe('0.00');
    });
  });

  describe('calculatePurchaseTotals', () => {
    it('10. Multiple line subtotal calculation', () => {
      const result = calculatePurchaseTotals([
        { inventoryItemId: 'item-1', quantity: 2, unitRate: 50 }, // 100.00
        { inventoryItemId: 'item-2', quantity: 3, unitRate: 20 }, // 60.00
        { inventoryItemId: 'item-3', quantity: 1, unitRate: 40 }  // 40.00
      ]);

      expect(result.subtotal).toBe('200.00');
      expect(result.discount).toBe('0.00');
      expect(result.taxAmount).toBe('0.00');
      expect(result.grandTotal).toBe('200.00');
    });

    it('11. Header discount application', () => {
      const result = calculatePurchaseTotals(
        [
          { inventoryItemId: 'item-1', quantity: 2, unitRate: 100 } // 200.00
        ],
        25, // Header discount
        0
      );
      expect(result.subtotal).toBe('200.00');
      expect(result.discount).toBe('25.00');
      expect(result.grandTotal).toBe('175.00');
    });

    it('12. Header tax application', () => {
      const result = calculatePurchaseTotals(
        [
          { inventoryItemId: 'item-1', quantity: 2, unitRate: 100 } // 200.00
        ],
        0,
        18.50 // Header tax
      );
      expect(result.subtotal).toBe('200.00');
      expect(result.taxAmount).toBe('18.50');
      expect(result.grandTotal).toBe('218.50');
    });

    it('13. Grand total cannot become negative when discount exceeds subtotal', () => {
      const result = calculatePurchaseTotals(
        [
          { inventoryItemId: 'item-1', quantity: 1, unitRate: 50 } // 50.00
        ],
        100, // Header discount 100 > subtotal 50
        0
      );
      expect(result.subtotal).toBe('50.00');
      expect(result.discount).toBe('100.00');
      expect(result.grandTotal).toBe('0.00');
    });

    it('14. Decimal precision cases and avoiding JS floating-point errors', () => {
      // Classic JS float problem: 0.1 + 0.2 !== 0.3
      const result = calculatePurchaseTotals([
        { inventoryItemId: 'item-1', quantity: 0.1, unitRate: 1 },
        { inventoryItemId: 'item-2', quantity: 0.2, unitRate: 1 }
      ]);
      expect(result.lines[0].lineTotal).toBe('0.10');
      expect(result.lines[1].lineTotal).toBe('0.20');
      expect(result.subtotal).toBe('0.30');
      expect(result.grandTotal).toBe('0.30');
    });

    it('15. Strict ROUND_HALF_UP behavior', () => {
      // 1 qty @ 10.555 rate => 10.56
      const line1 = calculatePurchaseLine({
        inventoryItemId: 'item-1',
        quantity: 1,
        unitRate: '10.555'
      });
      expect(line1.lineTotal).toBe('10.56');

      // 1 qty @ 10.554 rate => 10.55
      const line2 = calculatePurchaseLine({
        inventoryItemId: 'item-1',
        quantity: 1,
        unitRate: '10.554'
      });
      expect(line2.lineTotal).toBe('10.55');

      // 1 qty @ 10.555 with tax 5% => 10.555 * 1.05 = 11.08275 => 11.08
      const line3 = calculatePurchaseLine({
        inventoryItemId: 'item-1',
        quantity: 1,
        unitRate: '10.555',
        taxRate: 5
      });
      expect(line3.lineTotal).toBe('11.08');
    });

    it('16. Rejects empty lines array', () => {
      expect(() => {
        calculatePurchaseTotals([]);
      }).toThrow('Purchase must contain at least one line.');
    });
  });
});
