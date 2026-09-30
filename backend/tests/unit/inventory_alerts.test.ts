import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';

describe('Inventory Low-Stock Threshold and Deficit Unit Tests', () => {
  function isLowStock(availableQuantity: string | number, minimumStock: string | number): boolean {
    return new Decimal(availableQuantity).lessThanOrEqualTo(new Decimal(minimumStock));
  }

  function calculateDeficit(availableQuantity: string | number, minimumStock: string | number): string {
    const available = new Decimal(availableQuantity);
    const minimum = new Decimal(minimumStock);
    if (available.greaterThan(minimum)) {
      return '0.000';
    }
    return minimum.minus(available).toFixed(3);
  }

  it('should identify item as low-stock when available < minimum', () => {
    expect(isLowStock('2.500', '5.000')).toBe(true);
    expect(calculateDeficit('2.500', '5.000')).toBe('2.500');
  });

  it('should identify item as low-stock at exact threshold equality (available == minimum)', () => {
    expect(isLowStock('5.000', '5.000')).toBe(true);
    expect(calculateDeficit('5.000', '5.000')).toBe('0.000');
  });

  it('should NOT identify item as low-stock when available > minimum', () => {
    expect(isLowStock('5.001', '5.000')).toBe(false);
    expect(calculateDeficit('5.001', '5.000')).toBe('0.000');
  });

  it('should calculate deficit accurately when stock is zero', () => {
    expect(isLowStock('0.000', '10.000')).toBe(true);
    expect(calculateDeficit('0.000', '10.000')).toBe('10.000');
  });

  it('should handle fractional quantities correctly', () => {
    expect(isLowStock('0.125', '0.500')).toBe(true);
    expect(calculateDeficit('0.125', '0.500')).toBe('0.375');
  });
});
