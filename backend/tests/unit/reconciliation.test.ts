import { describe, it, expect } from 'vitest';
import { addMoney, subtractMoney, toDecimal } from '@/shared/money/decimal';

describe('Daily Closing Reconciliation Formula Tests', () => {
  it('should calculate Expected Closing Cash correctly: Opening Cash + Cash Sales - Cash Expenses', () => {
    const openingCash = '1000.00';
    const cashSales = '4500.50';
    const cashExpenses = '1200.00';

    const expectedClosingCash = subtractMoney(addMoney(openingCash, cashSales), cashExpenses);
    expect(expectedClosingCash).toBe('4300.50');
  });

  it('should classify MATCHED cash status when actual equals expected', () => {
    const expectedClosingCash = '4300.50';
    const actualCash = '4300.50';
    const cashDiff = subtractMoney(actualCash, expectedClosingCash);
    expect(cashDiff).toBe('0.00');
    expect(toDecimal(cashDiff).equals(0)).toBe(true);
  });

  it('should classify SHORTAGE when actual is less than expected', () => {
    const expectedClosingCash = '4300.50';
    const actualCash = '4200.00';
    const cashDiff = subtractMoney(actualCash, expectedClosingCash);
    expect(cashDiff).toBe('-100.50');
    expect(toDecimal(cashDiff).lessThan(0)).toBe(true);
  });

  it('should classify EXCESS when actual is greater than expected', () => {
    const expectedClosingCash = '4300.50';
    const actualCash = '4500.00';
    const cashDiff = subtractMoney(actualCash, expectedClosingCash);
    expect(cashDiff).toBe('199.50');
    expect(toDecimal(cashDiff).greaterThan(0)).toBe(true);
  });
});
