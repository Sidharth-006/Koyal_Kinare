import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(value: number | string | Decimal): Decimal {
  return new Decimal(value || 0);
}

export function formatMoney(value: number | string | Decimal): string {
  return toDecimal(value).toFixed(2);
}

export function addMoney(a: number | string | Decimal, b: number | string | Decimal): string {
  return toDecimal(a).plus(toDecimal(b)).toFixed(2);
}

export function subtractMoney(a: number | string | Decimal, b: number | string | Decimal): string {
  return toDecimal(a).minus(toDecimal(b)).toFixed(2);
}

export function multiplyMoney(a: number | string | Decimal, b: number | string | Decimal): string {
  return toDecimal(a).times(toDecimal(b)).toFixed(2);
}

export function calculateTaxExclusive(subtotal: string | number, discount: string | number, rate: string | number): { taxAmount: string; grandTotal: string } {
  const taxable = Decimal.max(0, toDecimal(subtotal).minus(toDecimal(discount)));
  const taxAmount = taxable.times(toDecimal(rate)).dividedBy(100).toFixed(2);
  const grandTotal = taxable.plus(toDecimal(taxAmount)).toFixed(2);
  return { taxAmount, grandTotal };
}

export function calculateTaxInclusive(subtotal: string | number, discount: string | number, rate: string | number): { taxAmount: string; grandTotal: string } {
  const total = Decimal.max(0, toDecimal(subtotal).minus(toDecimal(discount)));
  const taxRateDecimal = toDecimal(rate).dividedBy(100);
  const taxableBase = total.dividedBy(toDecimal(1).plus(taxRateDecimal));
  const taxAmount = total.minus(taxableBase).toFixed(2);
  return { taxAmount, grandTotal: total.toFixed(2) };
}
