import Decimal from 'decimal.js';
import { PurchaseLineInput } from './purchases.types';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface CalculatedPurchaseLine {
  inventoryItemId: string;
  quantity: string;
  unitRate: string;
  lineDiscount: string;
  taxRate: string;
  lineTotal: string;
}

export interface CalculatedPurchaseTotals {
  lines: CalculatedPurchaseLine[];
  subtotal: string;
  discount: string;
  taxAmount: string;
  grandTotal: string;
}

/**
 * Validates non-negative numerical constraint
 */
export function validateNonNegative(value: number | string, fieldName: string): Decimal {
  const d = new Decimal(value === '' || value === undefined || value === null ? 0 : value);
  if (d.isNaN()) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  if (d.isNegative()) {
    throw new Error(`${fieldName} cannot be negative.`);
  }
  return d;
}

/**
 * Validates strictly positive numerical constraint
 */
export function validatePositive(value: number | string, fieldName: string): Decimal {
  const d = new Decimal(value === '' || value === undefined || value === null ? 0 : value);
  if (d.isNaN()) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  if (!d.isPositive() || d.isZero()) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }
  return d;
}

/**
 * Calculates a single purchase line using Decimal.js with ROUND_HALF_UP rounding:
 * 1. Base = quantity × unitRate
 * 2. Discounted line = max(0, Base - lineDiscount)
 * 3. Tax = Discounted line × (taxRate / 100)
 * 4. Line total = round(Discounted line + Tax, 2)
 */
export function calculatePurchaseLine(line: PurchaseLineInput): CalculatedPurchaseLine {
  const qty = validatePositive(line.quantity, 'Quantity');
  const rate = validateNonNegative(line.unitRate, 'Unit rate');
  const discount = validateNonNegative(line.lineDiscount ?? 0, 'Line discount');
  const taxRate = validateNonNegative(line.taxRate ?? 0, 'Tax rate');

  const base = qty.times(rate);
  const discountedLine = Decimal.max(0, base.minus(discount));
  const taxAmount = discountedLine.times(taxRate).dividedBy(100);
  const lineTotal = discountedLine.plus(taxAmount).toFixed(2);

  return {
    inventoryItemId: line.inventoryItemId,
    quantity: qty.toFixed(3),
    unitRate: rate.toFixed(2),
    lineDiscount: discount.toFixed(2),
    taxRate: taxRate.toFixed(2),
    lineTotal
  };
}

/**
 * Calculates all purchase lines and grand totals:
 * 1. Subtotal = sum of calculated line totals
 * 2. Grand total = max(0, Subtotal - headerDiscount + headerTax)
 *
 * Client-provided line_total or grand_total is NEVER trusted.
 */
export function calculatePurchaseTotals(
  lines: PurchaseLineInput[],
  headerDiscount: number | string = 0,
  headerTax: number | string = 0
): CalculatedPurchaseTotals {
  if (!lines || lines.length === 0) {
    throw new Error('Purchase must contain at least one line.');
  }

  const calculatedLines = lines.map(calculatePurchaseLine);

  let subtotalDec = new Decimal(0);
  for (const line of calculatedLines) {
    subtotalDec = subtotalDec.plus(new Decimal(line.lineTotal));
  }

  const discountDec = validateNonNegative(headerDiscount, 'Header discount');
  const taxDec = validateNonNegative(headerTax, 'Header tax');

  const grandTotalDec = Decimal.max(
    0,
    subtotalDec.minus(discountDec).plus(taxDec)
  );

  return {
    lines: calculatedLines,
    subtotal: subtotalDec.toFixed(2),
    discount: discountDec.toFixed(2),
    taxAmount: taxDec.toFixed(2),
    grandTotal: grandTotalDec.toFixed(2)
  };
}
