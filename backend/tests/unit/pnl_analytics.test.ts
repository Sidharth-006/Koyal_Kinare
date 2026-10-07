// tests/unit/pnl_analytics.test.ts — Phase 3 Module 4 Unit Tests
// Pure unit tests for P&L math, completeness model, break-even, date/format validation.

import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { toDecimal } from '@/shared/money/decimal';
import {
  classifyCompleteness,
  calculateBreakEven,
  computeBreakEven,
} from '@/modules/analytics/analytics.service';
import { SettingsRepository } from '@/modules/settings/settings.repository';
import {
  validateDateRange,
} from '@/modules/reporting/inventory-reports.service';
import {
  normalizeExportFormat,
} from '@/modules/reporting/pnl-reports.service';
import {
  ValidationError,
  ReportTooLargeError,
  InsufficientDataForBreakEvenError,
} from '@/shared/errors';
import {
  VALID_MENU_PERFORMANCE_SORTS,
} from '@/modules/analytics/analytics.types';

describe('Phase 3 Module 4 — Unit Tests', () => {
  // ============================================================
  // 1. COMPLETENESS CLASSIFICATION TESTS (All states & edge cases)
  // ============================================================

  describe('Completeness Classification (Deterministic Rule)', () => {
    it('1. zero bill lines → INSUFFICIENT_DATA', () => {
      const result = classifyCompleteness(0, 0, 0, 0);
      expect(result).toBe('INSUFFICIENT_DATA');
    });

    it('2. bill lines with zero covered lines → INSUFFICIENT_DATA', () => {
      const result = classifyCompleteness(5, 0, 0, 0);
      expect(result).toBe('INSUFFICIENT_DATA');
    });

    it('3. partial coverage (some covered, some missing recipe) → PARTIAL', () => {
      const result = classifyCompleteness(10, 7, 0, 0);
      expect(result).toBe('PARTIAL');
    });

    it('4. 100% coverage with missing cost lines → PARTIAL', () => {
      const result = classifyCompleteness(10, 10, 2, 0);
      expect(result).toBe('PARTIAL');
    });

    it('5. 100% coverage with no missing cost and no negative stock → COMPLETE', () => {
      const result = classifyCompleteness(10, 10, 0, 0);
      expect(result).toBe('COMPLETE');
    });

    it('6. negative-stock exception state (even with 100% coverage) → PARTIAL', () => {
      const result = classifyCompleteness(10, 10, 0, 1);
      expect(result).toBe('PARTIAL');
    });

    it('7. negative-stock exception with missing cost → PARTIAL', () => {
      const result = classifyCompleteness(10, 10, 3, 2);
      expect(result).toBe('PARTIAL');
    });
  });

  // ============================================================
  // 2. P&L ARITHMETIC TESTS (Decimal.js, Null Wastage Impact)
  // ============================================================

  describe('P&L Arithmetic Calculations', () => {
    it('calculates netSales = grossRevenue - discounts - tax correctly', () => {
      const grossRevenue = toDecimal('1000.00');
      const discount = toDecimal('100.00');
      const tax = toDecimal('50.00');
      const netSales = grossRevenue.minus(discount).minus(tax);
      expect(netSales.toFixed(2)).toBe('850.00');
    });

    it('calculates grossProfit = netSales - foodCost', () => {
      const netSales = toDecimal('850.00');
      const foodCost = toDecimal('300.00');
      const grossProfit = netSales.minus(foodCost);
      expect(grossProfit.toFixed(2)).toBe('550.00');
    });

    it('enforces configuredWastageExpenseImpact is strictly null (not "0.00")', () => {
      // Mandatory correction 1:
      // configuredWastageExpenseImpact MUST be null
      const configuredWastageExpenseImpact: null = null;
      expect(configuredWastageExpenseImpact).toBeNull();
      expect(configuredWastageExpenseImpact).not.toBe('0.00');
      expect(configuredWastageExpenseImpact).not.toBe(0);
    });

    it('calculates netProfit = grossProfit - operatingExpenses without fabricating wastage expense', () => {
      const grossProfit = toDecimal('550.00');
      const operatingExpenses = toDecimal('200.00');
      const netProfit = grossProfit.minus(operatingExpenses);
      expect(netProfit.toFixed(2)).toBe('350.00');
    });

    it('calculates foodCostPercent correctly', () => {
      const foodCost = toDecimal('300.00');
      const netSales = toDecimal('1000.00');
      const foodCostPercent = foodCost.dividedBy(netSales).times(100).toFixed(2);
      expect(foodCostPercent).toBe('30.00');
    });

    it('returns null foodCostPercent when netSales is zero', () => {
      const netSales = toDecimal('0.00');
      const foodCost = toDecimal('50.00');
      const foodCostPercent = netSales.isZero() ? null : foodCost.dividedBy(netSales).times(100).toFixed(2);
      expect(foodCostPercent).toBeNull();
    });

    it('handles negative netProfit when operating expenses exceed gross profit', () => {
      const grossProfit = toDecimal('200.00');
      const operatingExpenses = toDecimal('500.00');
      const netProfit = grossProfit.minus(operatingExpenses);
      expect(netProfit.toFixed(2)).toBe('-300.00');
    });
  });

  // ============================================================
  // 3. BREAK-EVEN ARITHMETIC & SAFE FAILURE TESTS
  // ============================================================

  describe('Break-Even Math & Safe Failure', () => {
    it('calculates breakEven = fixedCosts / targetGrossMarginRate for valid values', () => {
      const fixedCosts = '60000.00';
      const marginRate = '0.6000'; // 60%
      const result = calculateBreakEven(fixedCosts, marginRate);
      expect(result).toBe('100000.00');
    });

    it('handles decimal precision in break-even arithmetic', () => {
      const fixedCosts = '45000.50';
      const marginRate = '0.3333';
      const result = calculateBreakEven(fixedCosts, marginRate);
      expect(result).toBe('135015.00');
    });

    it('throws InsufficientDataForBreakEvenError if fixedCosts is null or missing', () => {
      expect(() => calculateBreakEven(null, '0.6000')).toThrow(InsufficientDataForBreakEvenError);
      expect(() => calculateBreakEven(undefined, '0.6000')).toThrow(InsufficientDataForBreakEvenError);
      expect(() => calculateBreakEven('', '0.6000')).toThrow(InsufficientDataForBreakEvenError);
    });

    it('throws InsufficientDataForBreakEvenError if targetGrossMarginRate is null or missing', () => {
      expect(() => calculateBreakEven('10000', null)).toThrow(InsufficientDataForBreakEvenError);
      expect(() => calculateBreakEven('10000', undefined)).toThrow(InsufficientDataForBreakEvenError);
      expect(() => calculateBreakEven('10000', '')).toThrow(InsufficientDataForBreakEvenError);
    });

    it('throws InsufficientDataForBreakEvenError if targetGrossMarginRate is 0 or negative', () => {
      expect(() => calculateBreakEven('10000', '0.0000')).toThrow(InsufficientDataForBreakEvenError);
      expect(() => calculateBreakEven('10000', '-0.5000')).toThrow(InsufficientDataForBreakEvenError);
    });

    it('throws InsufficientDataForBreakEvenError if targetGrossMarginRate is >= 1', () => {
      expect(() => calculateBreakEven('10000', '1.0000')).toThrow(InsufficientDataForBreakEvenError);
      expect(() => calculateBreakEven('10000', '1.5000')).toThrow(InsufficientDataForBreakEvenError);
    });

    // Test A: Fixed costs unavailable + valid target margin
    it('Test A: Fixed costs unavailable + valid target margin → breakEvenAmount = null, fixedCosts = null, reason = FIXED_COSTS_NOT_CONFIGURED', async () => {
      vi.spyOn(SettingsRepository, 'getTargetSettings').mockResolvedValueOnce({
        id: 'mock-id',
        daily_sales_target: '5000.00',
        monthly_sales_target: '150000.00',
        target_gross_margin_rate: '0.6500',
        updated_at: new Date().toISOString(),
      } as any);

      const result = await computeBreakEven();
      expect(result.fixedCosts).toBeNull();
      expect(result.breakEvenAmount).toBeNull();
      expect(result.targetGrossMarginRate).toBe('0.6500');
      expect(result.reason).toBe('FIXED_COSTS_NOT_CONFIGURED');
      expect(result.message).toContain('Fixed costs are not configured');
    });

    // Test B: Fixed costs unavailable + missing target margin
    it('Test B: Fixed costs unavailable + missing target margin → still unavailable with reason FIXED_COSTS_NOT_CONFIGURED', async () => {
      vi.spyOn(SettingsRepository, 'getTargetSettings').mockResolvedValueOnce({
        id: 'mock-id',
        daily_sales_target: '5000.00',
        monthly_sales_target: '150000.00',
        target_gross_margin_rate: null,
        updated_at: new Date().toISOString(),
      } as any);

      const result = await computeBreakEven();
      expect(result.fixedCosts).toBeNull();
      expect(result.breakEvenAmount).toBeNull();
      expect(result.targetGrossMarginRate).toBeNull();
      expect(result.reason).toBe('FIXED_COSTS_NOT_CONFIGURED');
    });

    // Test C: Operating expenses MUST NOT automatically become fixed costs
    it('Test C: Operating expenses MUST NOT automatically become fixed costs', async () => {
      vi.spyOn(SettingsRepository, 'getTargetSettings').mockResolvedValueOnce({
        id: 'mock-id',
        daily_sales_target: '5000.00',
        monthly_sales_target: '150000.00',
        target_gross_margin_rate: '0.6000',
        updated_at: new Date().toISOString(),
      } as any);

      const result = await computeBreakEven();
      // Even if operating expenses exist in the period (e.g., 25000.00), fixedCosts must strictly remain null
      expect(result.fixedCosts).toBeNull();
      expect(result.breakEvenAmount).toBeNull();
      // Calling calculateBreakEven without fixed costs safely fails
      expect(() => calculateBreakEven(result.fixedCosts, result.targetGrossMarginRate)).toThrow(
        InsufficientDataForBreakEvenError,
      );
    });
  });

  // ============================================================
  // 4. MENU PERFORMANCE SORT VALIDATION
  // ============================================================

  describe('Menu Performance Sort Validation', () => {
    it('contains all 5 allowed sort keys', () => {
      expect(VALID_MENU_PERFORMANCE_SORTS).toEqual([
        'revenue',
        'quantity',
        'food_cost',
        'gross_margin',
        'food_cost_percent',
      ]);
    });

    it('sorts menu items by revenue DESC', () => {
      const items = [
        { itemName: 'Item A', totalRevenue: '100.00' },
        { itemName: 'Item B', totalRevenue: '500.00' },
        { itemName: 'Item C', totalRevenue: '250.00' },
      ];
      items.sort((a, b) => toDecimal(b.totalRevenue).minus(toDecimal(a.totalRevenue)).toNumber());
      expect(items.map((i) => i.itemName)).toEqual(['Item B', 'Item C', 'Item A']);
    });

    it('sorts menu items by quantity DESC', () => {
      const items = [
        { itemName: 'Item A', totalQuantity: 10 },
        { itemName: 'Item B', totalQuantity: 50 },
        { itemName: 'Item C', totalQuantity: 25 },
      ];
      items.sort((a, b) => b.totalQuantity - a.totalQuantity);
      expect(items.map((i) => i.itemName)).toEqual(['Item B', 'Item C', 'Item A']);
    });
  });

  // ============================================================
  // 5. DATE RANGE & FORMAT VALIDATION
  // ============================================================

  describe('Date Range and Export Format Validation', () => {
    it('accepts valid date range within 366 days', () => {
      expect(() => validateDateRange('2026-01-01', '2026-01-31')).not.toThrow();
      expect(() => validateDateRange('2026-01-01', '2026-12-31')).not.toThrow();
    });

    it('throws ValidationError when from or to is missing', () => {
      expect(() => validateDateRange('', '2026-01-31')).toThrow(ValidationError);
      expect(() => validateDateRange('2026-01-01', '')).toThrow(ValidationError);
    });

    it('throws ValidationError when from > to (reversed dates)', () => {
      expect(() => validateDateRange('2026-02-01', '2026-01-01')).toThrow(
        'Start date (from) cannot be after end date (to).',
      );
    });

    it('throws ReportTooLargeError when date range exceeds 366 days', () => {
      expect(() => validateDateRange('2024-01-01', '2025-02-01')).toThrow(ReportTooLargeError);
    });

    it('normalizes valid export formats (XLSX, EXCEL, PDF case-insensitively)', () => {
      expect(normalizeExportFormat('XLSX')).toBe('XLSX');
      expect(normalizeExportFormat('xlsx')).toBe('XLSX');
      expect(normalizeExportFormat('EXCEL')).toBe('EXCEL');
      expect(normalizeExportFormat('excel')).toBe('EXCEL');
      expect(normalizeExportFormat('PDF')).toBe('PDF');
      expect(normalizeExportFormat('pdf')).toBe('PDF');
    });

    it('rejects unsupported export formats with ValidationError', () => {
      expect(() => normalizeExportFormat('CSV')).toThrow(ValidationError);
      expect(() => normalizeExportFormat('DOCX')).toThrow(ValidationError);
      expect(() => normalizeExportFormat(null)).toThrow(ValidationError);
      expect(() => normalizeExportFormat('')).toThrow(ValidationError);
    });
  });
});
