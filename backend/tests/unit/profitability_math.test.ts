import { describe, it, expect } from 'vitest';
import { addMoney, subtractMoney } from '@/shared/money/decimal';

describe('Phase 2 Profitability Mathematical Formula Unit Tests', () => {
  it('should calculate Phase 1 Net Profit as Sales minus Operating Expenses', () => {
    const totalSales = '25000.00';
    const totalExpenses = '8000.00';
    const phase1Profit = subtractMoney(totalSales, totalExpenses);

    expect(phase1Profit).toBe('17000.00');
  });

  it('should calculate Phase 2 Estimated Net Profit as Sales - Expenses - Received Purchases', () => {
    const totalSales = '25000.00';
    const totalExpenses = '8000.00';
    const totalPurchases = '6500.00';

    const phase1Profit = subtractMoney(totalSales, totalExpenses);
    const phase2Profit = subtractMoney(phase1Profit, totalPurchases);

    expect(phase2Profit).toBe('10500.00');
  });

  it('should handle zero or loss results accurately', () => {
    const totalSales = '5000.00';
    const totalExpenses = '4000.00';
    const totalPurchases = '3000.00';

    const phase1Profit = subtractMoney(totalSales, totalExpenses);
    const phase2Profit = subtractMoney(phase1Profit, totalPurchases);

    expect(phase1Profit).toBe('1000.00');
    expect(phase2Profit).toBe('-2000.00');
  });
});
