import { describe, it, expect } from 'vitest';

describe('POS & Reconciliation Mathematical Logic', () => {
  it('calculates cart subtotal, discount, and provisional grand total accurately', () => {
    const items = [
      { price: 150, qty: 2 }, // 300
      { price: 250, qty: 1 }  // 250
    ];
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0); // 550
    const discount = 50;
    const estTotal = Math.max(0, subtotal - discount); // 500

    expect(subtotal).toBe(550);
    expect(estTotal).toBe(500);
  });

  it('calculates expected cash and cash variance correctly', () => {
    const openingCash = 1000;
    const cashSales = 500;
    const cashExpenses = 100;

    const expectedCash = openingCash + cashSales - cashExpenses; // 1400
    expect(expectedCash).toBe(1400);

    const actualCashMatched = 1400;
    const varianceMatched = actualCashMatched - expectedCash;
    expect(varianceMatched).toBe(0);

    const actualCashShortage = 1350;
    const varianceShortage = actualCashShortage - expectedCash;
    expect(varianceShortage).toBe(-50);

    const actualCashExcess = 1450;
    const varianceExcess = actualCashExcess - expectedCash;
    expect(varianceExcess).toBe(50);
  });
});
