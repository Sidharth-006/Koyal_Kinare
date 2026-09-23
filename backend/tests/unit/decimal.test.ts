import { describe, it, expect } from 'vitest';
import { calculateTaxExclusive, calculateTaxInclusive, addMoney, subtractMoney, multiplyMoney } from '@/shared/money/decimal';

describe('Decimal Money Arithmetic Tests', () => {
  it('should format and add money precisely without floating point drift', () => {
    const res = addMoney('10.10', '20.20');
    expect(res).toBe('30.30');
  });

  it('should subtract money precisely', () => {
    const res = subtractMoney('50.00', '12.45');
    expect(res).toBe('37.55');
  });

  it('should multiply quantity and unit price correctly', () => {
    const res = multiplyMoney('120.50', 3);
    expect(res).toBe('361.50');
  });

  it('should calculate 5% exclusive tax correctly', () => {
    const calc = calculateTaxExclusive('100.00', '0.00', '5.00');
    expect(calc.taxAmount).toBe('5.00');
    expect(calc.grandTotal).toBe('105.00');
  });

  it('should calculate 5% inclusive tax correctly', () => {
    const calc = calculateTaxInclusive('105.00', '0.00', '5.00');
    expect(calc.taxAmount).toBe('5.00');
    expect(calc.grandTotal).toBe('105.00');
  });

  it('should apply discount before calculating tax in exclusive mode', () => {
    const calc = calculateTaxExclusive('200.00', '50.00', '5.00'); // Subtotal 200, discount 50 -> Taxable 150 -> Tax 7.50 -> Total 157.50
    expect(calc.taxAmount).toBe('7.50');
    expect(calc.grandTotal).toBe('157.50');
  });
});
