// analytics.service.ts — Phase 3 Module 4
// Authoritative P&L, completeness model, break-even, overview, and menu performance.
// Uses ONLY historic transaction snapshots. Does NOT mutate any operational data.

import Decimal from 'decimal.js';
import { AnalyticsRepository } from './analytics.repository';
import { SettingsRepository } from '../settings/settings.repository';
import { validateDateRange } from '../reporting/inventory-reports.service';
import { toDecimal } from '@/shared/money/decimal';
import { InsufficientDataForBreakEvenError, ValidationError } from '@/shared/errors';
import {
  PnlResult,
  PnlCompletenessModel,
  BreakEvenResult,
  CompletenessStatus,
  AnalyticsOverviewResult,
  MenuPerformanceResult,
  MenuPerformanceItem,
  InventoryValuationResult,
  ReconciliationRangeResult,
  ReconciliationDayRow,
  MonthlyPnlResult,
  MonthlyPnlRow,
  VALID_MENU_PERFORMANCE_SORTS,
  MenuPerformanceSortKey,
  WastageIndicators,
} from './analytics.types';

// ============================================================
// HELPERS
// ============================================================

function getReportedAt(): string {
  return new Date().toISOString();
}

function getTimezone(): string {
  return 'Asia/Kolkata';
}

/**
 * Deterministic completeness classification rule derived from available DLD metrics.
 * Note: This is the implementation's deterministic classification rule derived from available
 * DLD metrics, not an explicit threshold prescribed by the DLD specification.
 *
 * Rules:
 * - INSUFFICIENT_DATA: totalBillLines === 0 OR coveredLines === 0
 * - COMPLETE: 100% recipe coverage (coveredLines === totalBillLines) AND missingCostLines === 0 AND negativeStockExceptionCount === 0
 * - PARTIAL: otherwise
 */
export function classifyCompleteness(
  totalBillLines: number,
  coveredLines: number,
  missingCostLines: number,
  negativeStockExceptionCount: number,
): CompletenessStatus {
  if (totalBillLines === 0 || coveredLines === 0) {
    return 'INSUFFICIENT_DATA';
  }
  if (
    coveredLines === totalBillLines &&
    missingCostLines === 0 &&
    negativeStockExceptionCount === 0
  ) {
    return 'COMPLETE';
  }
  return 'PARTIAL';
}

/**
 * Build completeness model from raw DB aggregation rows.
 */
async function buildCompletenessModel(
  from: string,
  to: string,
  coverageRow: any,
  missingRecipeSalesAmount: string,
): Promise<PnlCompletenessModel> {
  const totalBillLines = parseInt(coverageRow.total_bill_lines ?? '0', 10);
  const coveredLines = parseInt(coverageRow.covered_lines ?? '0', 10);
  const missingRecipeLines = parseInt(coverageRow.missing_recipe_lines ?? '0', 10);
  const missingCostLines = parseInt(coverageRow.missing_cost_lines ?? '0', 10);
  const negativeStockExceptionCount = parseInt(coverageRow.negative_stock_exception_count ?? '0', 10);

  const recipeCoveragePercent =
    totalBillLines > 0
      ? toDecimal(coveredLines).dividedBy(totalBillLines).times(100).toFixed(2)
      : null;

  const completenessStatus = classifyCompleteness(
    totalBillLines,
    coveredLines,
    missingCostLines,
    negativeStockExceptionCount,
  );

  return {
    totalBillLines,
    coveredLines,
    missingRecipeLines,
    missingCostLines,
    negativeStockExceptionCount,
    recipeCoveragePercent,
    missingRecipeSalesAmount,
    missingCostAmount: '0.00', // Not synthetically calculable; missing cost = data gap, not a zero cost
    completenessStatus,
  };
}

/**
 * Pure calculation helper for break-even arithmetic: fixedCosts / targetGrossMarginRate.
 * Requires fixedCosts to be provided and targetGrossMarginRate to be in (0, 1).
 */
export function calculateBreakEven(
  fixedCosts: string | null | undefined,
  targetGrossMarginRate: string | null | undefined,
): string {
  if (fixedCosts === null || fixedCosts === undefined || fixedCosts === '') {
    throw new InsufficientDataForBreakEvenError('Fixed costs are not configured.');
  }
  if (targetGrossMarginRate === null || targetGrossMarginRate === undefined || targetGrossMarginRate === '') {
    throw new InsufficientDataForBreakEvenError('Target gross margin rate is not configured.');
  }
  const fc = toDecimal(fixedCosts);
  const rate = toDecimal(targetGrossMarginRate);
  if (rate.isZero() || rate.isNegative() || rate.greaterThanOrEqualTo(1)) {
    throw new InsufficientDataForBreakEvenError('Target gross margin rate must be between 0 and 1 exclusive.');
  }
  return fc.dividedBy(rate).toFixed(2);
}

/**
 * Compute break-even using target_settings.target_gross_margin_rate.
 *
 * Mandatory DLD rule:
 * breakEvenAmount = fixedCosts / targetGrossMarginRate
 *
 * The frozen Phase 1–3 schema has NO authoritative fixed-cost source and NO fixed-vs-variable classification.
 * - Do NOT calculate break-even merely because target_gross_margin_rate exists.
 * - Do NOT treat operating expenses as fixed costs.
 * - Do NOT invent fixed costs.
 * - Keep break-even unavailable when fixed costs are unavailable.
 *
 * Required result when fixed costs are unavailable:
 * fixedCosts: null
 * breakEvenAmount: null
 * reason: FIXED_COSTS_NOT_CONFIGURED
 */
export async function computeBreakEven(): Promise<BreakEvenResult> {
  const targetSettings = await SettingsRepository.getTargetSettings();
  const rate = (targetSettings as any)?.target_gross_margin_rate;
  const targetGrossMarginRate =
    rate !== null && rate !== undefined && !toDecimal(rate).isZero() && !toDecimal(rate).isNegative()
      ? toDecimal(rate).toFixed(4)
      : null;

  return {
    breakEvenAmount: null,
    fixedCosts: null,
    targetGrossMarginRate,
    reason: 'FIXED_COSTS_NOT_CONFIGURED',
    message: 'Fixed costs are not configured: the frozen schema contains no authoritative fixed-cost source or classification. Operating expenses cannot be treated as fixed costs.',
  };
}

// ============================================================
// P&L SERVICE
// ============================================================

export class AnalyticsService {
  static async getPnl(from: string, to: string): Promise<PnlResult> {
    validateDateRange(from, to);

    const businessSettings = await SettingsRepository.getBusinessSettings();

    const billsSummary = await AnalyticsRepository.getBillsSummary(from, to);
    const [foodCostAgg, coverageAgg] = await Promise.all([
      AnalyticsRepository.getFoodCostAggregation(from, to),
      AnalyticsRepository.getCoverageAggregation(from, to),
    ]);
    const [opExpenses, missingRecipeSalesAmount, wastageRow] = await Promise.all([
      AnalyticsRepository.getOperatingExpenses(from, to),
      AnalyticsRepository.getMissingRecipeSalesAmount(from, to),
      AnalyticsRepository.getWastageIndicators(from, to),
    ]);

    // DLD-exact P&L calculation using Decimal.js
    const grossRevenue = toDecimal(billsSummary.gross_revenue);
    const totalDiscounts = toDecimal(billsSummary.total_discount);
    const totalTax = toDecimal(billsSummary.total_tax);
    const netSales = grossRevenue.minus(totalDiscounts).minus(totalTax);
    const foodCost = toDecimal(foodCostAgg.food_cost);
    const grossProfit = netSales.minus(foodCost);
    const operatingExpenses = toDecimal(opExpenses.total_expenses);

    // Available-data net profit: netProfit = grossProfit - operatingExpenses
    // configuredWastageExpenseImpact is strictly null (frozen schema limitation)
    const netProfit = grossProfit.minus(operatingExpenses);

    const foodCostPercent = netSales.isZero()
      ? null
      : foodCost.dividedBy(netSales).times(100).toFixed(2);

    const completeness = await buildCompletenessModel(from, to, coverageAgg, missingRecipeSalesAmount);
    const breakEven = await computeBreakEven();

    const wastageIndicators: WastageIndicators = {
      wastageCount: parseInt(wastageRow?.wastage_count ?? '0', 10),
      wastageQuantity: toDecimal(wastageRow?.wastage_quantity ?? '0').toFixed(3),
      countCorrectionDeficitCount: parseInt(wastageRow?.count_correction_deficit_count ?? '0', 10),
      countCorrectionDeficitQuantity: toDecimal(wastageRow?.count_correction_deficit_quantity ?? '0').toFixed(3),
    };

    const dataLimitations: string[] = [
      'Configured wastage/adjustment monetary expense impact is unavailable in the frozen schema. Wastage and physical count corrections are tracked purely as physical quantity deltas without configured unit costs or monetary expense rules. Therefore, configuredWastageExpenseImpact is null and netProfit reflects grossProfit minus operatingExpenses.',
      'Fixed costs are not configured: the frozen Phase 1–3 schema contains no authoritative fixed-cost source or fixed-vs-variable classification. Operating expenses cannot be assumed to be fixed costs. Break-even amount and fixed costs are returned as null with reason FIXED_COSTS_NOT_CONFIGURED.',
      'The frozen expense schema does not contain an authoritative indicator distinguishing inventory-related expenses (such as legacy RAW_MATERIALS) from operating overhead. Operating expenses reflect all active, non-voided expenses recorded in the period without synthetic filtering.',
    ];

    return {
      reportType: 'PNL',
      dateRange: { from, to },
      reportedAt: getReportedAt(),
      cafeIdentity: {
        cafeName: businessSettings.cafe_name,
        currency: businessSettings.currency,
      },
      timezone: getTimezone(),
      grossRevenue: grossRevenue.toFixed(2),
      totalDiscounts: totalDiscounts.toFixed(2),
      totalTax: totalTax.toFixed(2),
      netSales: netSales.toFixed(2),
      foodCost: foodCost.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      operatingExpenses: operatingExpenses.toFixed(2),
      configuredWastageExpenseImpact: null, // MANDATORY: MUST be null, NOT "0.00"
      netProfit: netProfit.toFixed(2),
      foodCostPercent,
      billCount: parseInt(billsSummary.bill_count ?? '0', 10),
      completeness,
      breakEven,
      paymentSplits: {
        CASH: toDecimal(billsSummary.cash_total).toFixed(2),
        UPI: toDecimal(billsSummary.upi_total).toFixed(2),
        CARD: toDecimal(billsSummary.card_total).toFixed(2),
      },
      wastageIndicators,
      dataLimitations,
    };
  }

  // ============================================================
  // ANALYTICS OVERVIEW
  // ============================================================

  static async getOverview(from: string, to: string): Promise<AnalyticsOverviewResult> {
    validateDateRange(from, to);

    const businessSettings = await SettingsRepository.getBusinessSettings();

    const billsSummary = await AnalyticsRepository.getBillsSummary(from, to);
    const [foodCostAgg, coverageAgg] = await Promise.all([
      AnalyticsRepository.getFoodCostAggregation(from, to),
      AnalyticsRepository.getCoverageAggregation(from, to),
    ]);
    const [opExpenses, expensesByCategory] = await Promise.all([
      AnalyticsRepository.getOperatingExpenses(from, to),
      AnalyticsRepository.getExpensesByCategory(from, to),
    ]);
    const [voidedBillCount, wastageRow] = await Promise.all([
      AnalyticsRepository.getVoidedBillCount(from, to),
      AnalyticsRepository.getWastageIndicators(from, to),
    ]);

    const grossRevenue = toDecimal(billsSummary.gross_revenue);
    const totalDiscount = toDecimal(billsSummary.total_discount);
    const totalTax = toDecimal(billsSummary.total_tax);
    const netSales = grossRevenue.minus(totalDiscount).minus(totalTax);
    const foodCost = toDecimal(foodCostAgg.food_cost);
    const grossProfit = netSales.minus(foodCost);
    const operatingExpenses = toDecimal(opExpenses.total_expenses);
    const netProfit = grossProfit.minus(operatingExpenses);

    const billCount = parseInt(billsSummary.bill_count ?? '0', 10);
    const averageOrderValue = billCount > 0
      ? grossRevenue.dividedBy(billCount).toFixed(2)
      : '0.00';

    const foodCostPercent = netSales.isZero()
      ? null
      : foodCost.dividedBy(netSales).times(100).toFixed(2);

    const totalBillLines = parseInt(coverageAgg.total_bill_lines ?? '0', 10);
    const coveredLines = parseInt(coverageAgg.covered_lines ?? '0', 10);
    const missingCostLines = parseInt(coverageAgg.missing_cost_lines ?? '0', 10);
    const negativeStockExceptionCount = parseInt(coverageAgg.negative_stock_exception_count ?? '0', 10);

    const coveragePercent = totalBillLines > 0
      ? toDecimal(coveredLines).dividedBy(totalBillLines).times(100).toFixed(2)
      : null;
    const completenessStatus = classifyCompleteness(
      totalBillLines, coveredLines, missingCostLines, negativeStockExceptionCount,
    );

    const wastageIndicators: WastageIndicators = {
      wastageCount: parseInt(wastageRow?.wastage_count ?? '0', 10),
      wastageQuantity: toDecimal(wastageRow?.wastage_quantity ?? '0').toFixed(3),
      countCorrectionDeficitCount: parseInt(wastageRow?.count_correction_deficit_count ?? '0', 10),
      countCorrectionDeficitQuantity: toDecimal(wastageRow?.count_correction_deficit_quantity ?? '0').toFixed(3),
    };

    const dataLimitations: string[] = [
      'Configured wastage/adjustment monetary expense impact is unavailable in the frozen schema. Wastage and physical count corrections are tracked purely as physical quantity deltas without configured unit costs or monetary expense rules.',
    ];

    return {
      reportType: 'ANALYTICS_OVERVIEW',
      dateRange: { from, to },
      reportedAt: getReportedAt(),
      cafeIdentity: {
        cafeName: businessSettings.cafe_name,
        currency: businessSettings.currency,
      },
      timezone: getTimezone(),
      revenue: {
        grossRevenue: grossRevenue.toFixed(2),
        netSales: netSales.toFixed(2),
        totalDiscount: totalDiscount.toFixed(2),
        totalTax: totalTax.toFixed(2),
        billCount,
        averageOrderValue,
      },
      paymentSplits: {
        CASH: toDecimal(billsSummary.cash_total).toFixed(2),
        UPI: toDecimal(billsSummary.upi_total).toFixed(2),
        CARD: toDecimal(billsSummary.card_total).toFixed(2),
      },
      expenses: {
        total: operatingExpenses.toFixed(2),
        byCategory: expensesByCategory.map((r: any) => ({
          category: r.category,
          total: String(r.total),
        })),
      },
      foodCost: {
        total: foodCost.toFixed(2),
        coveragePercent,
        completenessStatus,
      },
      profitability: {
        grossProfit: grossProfit.toFixed(2),
        netProfit: netProfit.toFixed(2),
        foodCostPercent,
      },
      operationalExceptions: {
        missingRecipeLines: parseInt(coverageAgg.missing_recipe_lines ?? '0', 10),
        missingCostLines,
        negativeStockOverrideBills: negativeStockExceptionCount,
        voidedBillCount,
      },
      wastageIndicators,
      dataLimitations,
    };
  }

  // ============================================================
  // MENU PERFORMANCE
  // ============================================================

  static async getMenuPerformance(
    from: string,
    to: string,
    sort: string | null,
  ): Promise<MenuPerformanceResult> {
    validateDateRange(from, to);

    const resolvedSort = sort ?? 'revenue';
    if (!VALID_MENU_PERFORMANCE_SORTS.includes(resolvedSort as MenuPerformanceSortKey)) {
      throw new ValidationError(
        `Invalid sort value "${resolvedSort}". Supported: ${VALID_MENU_PERFORMANCE_SORTS.join(', ')}.`,
      );
    }

    const businessSettings = await SettingsRepository.getBusinessSettings();
    const rows = await AnalyticsRepository.getMenuPerformance(from, to);

    const items: MenuPerformanceItem[] = rows.map((r: any) => {
      const totalRevenue = toDecimal(r.total_revenue);
      const hasCostData = r.food_cost !== null && r.lines_missing_cost === 0;
      const foodCost = hasCostData ? toDecimal(r.food_cost) : null;
      const grossMargin = hasCostData ? totalRevenue.minus(foodCost!) : null;
      const grossMarginPercent =
        hasCostData && !totalRevenue.isZero()
          ? grossMargin!.dividedBy(totalRevenue).times(100).toFixed(2)
          : null;
      const foodCostPercent =
        hasCostData && !totalRevenue.isZero()
          ? foodCost!.dividedBy(totalRevenue).times(100).toFixed(2)
          : null;

      const coveredCount = parseInt(r.covered_count ?? '0', 10);
      const missingRecipeCount = parseInt(r.missing_recipe_count ?? '0', 10);
      const totalQty = parseInt(r.total_quantity ?? '0', 10);
      const completenessStatus: CompletenessStatus =
        missingRecipeCount > 0
          ? 'PARTIAL'
          : hasCostData
          ? 'COMPLETE'
          : coveredCount > 0
          ? 'PARTIAL'
          : 'INSUFFICIENT_DATA';

      return {
        menuItemId: r.menu_item_id || null,
        itemName: r.item_name,
        categoryName: r.category_name,
        totalQuantity: totalQty,
        totalRevenue: totalRevenue.toFixed(2),
        foodCost: hasCostData ? foodCost!.toFixed(2) : null,
        grossMargin: grossMargin ? grossMargin.toFixed(2) : null,
        grossMarginPercent,
        foodCostPercent,
        hasCostData,
        completenessStatus,
      };
    });

    // Sort by the validated sort key (DESC for numeric fields)
    const sortedItems = [...items].sort((a, b) => {
      const key = resolvedSort as MenuPerformanceSortKey;
      switch (key) {
        case 'revenue':
          return toDecimal(b.totalRevenue).minus(toDecimal(a.totalRevenue)).toNumber();
        case 'quantity':
          return b.totalQuantity - a.totalQuantity;
        case 'food_cost':
          return toDecimal(b.foodCost ?? '-1').minus(toDecimal(a.foodCost ?? '-1')).toNumber();
        case 'gross_margin':
          return toDecimal(b.grossMargin ?? '-999999').minus(toDecimal(a.grossMargin ?? '-999999')).toNumber();
        case 'food_cost_percent':
          return toDecimal(b.foodCostPercent ?? '-1').minus(toDecimal(a.foodCostPercent ?? '-1')).toNumber();
        default:
          return 0;
      }
    });

    const itemsWithCostData = items.filter((i) => i.hasCostData).length;

    return {
      reportType: 'MENU_PERFORMANCE',
      dateRange: { from, to },
      reportedAt: getReportedAt(),
      cafeIdentity: {
        cafeName: businessSettings.cafe_name,
        currency: businessSettings.currency,
      },
      timezone: getTimezone(),
      appliedSort: resolvedSort,
      items: sortedItems,
      summary: {
        totalItems: items.length,
        itemsWithCostData,
        itemsWithoutCostData: items.length - itemsWithCostData,
      },
    };
  }

  // ============================================================
  // INVENTORY VALUATION
  // ============================================================

  static async getInventoryValuation(asOfDate?: string): Promise<InventoryValuationResult> {
    const businessSettings = await SettingsRepository.getBusinessSettings();
    const rows = await AnalyticsRepository.getInventoryValuation();
    const reportedAt = getReportedAt();
    const resolvedAsOf = asOfDate ?? new Date().toISOString().slice(0, 10);

    let totalValuation = new Decimal(0);
    let costedItems = 0;
    let uncostedItems = 0;

    const items = rows.map((r: any) => {
      const currentQty = toDecimal(r.current_quantity ?? '0');
      const avgCost = r.average_unit_cost !== null && r.average_unit_cost !== undefined
        ? toDecimal(r.average_unit_cost)
        : null;

      let totalValue: string | null = null;
      const hasWeightedAvgCost = avgCost !== null && avgCost.greaterThan(0);

      if (hasWeightedAvgCost) {
        const val = currentQty.times(avgCost!);
        totalValuation = totalValuation.plus(val);
        totalValue = val.toFixed(2);
        costedItems++;
      } else {
        uncostedItems++;
      }

      return {
        itemId: r.id,
        itemName: r.name,
        itemType: r.item_type,
        baseUnit: r.base_unit,
        currentQuantity: currentQty.toFixed(3),
        averageUnitCost: hasWeightedAvgCost ? avgCost!.toFixed(4) : null,
        totalValue,
        hasWeightedAvgCost,
      };
    });

    return {
      reportType: 'INVENTORY_VALUATION',
      asOfDate: resolvedAsOf,
      reportedAt,
      cafeIdentity: {
        cafeName: businessSettings.cafe_name,
        currency: businessSettings.currency,
      },
      timezone: getTimezone(),
      dataLimitation:
        'Valuation reflects the current weighted-average inventory cost state (inventory_cost_state table). ' +
        'Historical point-in-time valuation is not supported by the existing schema. ' +
        'The asOf parameter is accepted for future compatibility but does not filter historical data.',
      summary: {
        totalItems: items.length,
        costedItems,
        uncostedItems,
        totalValuation: totalValuation.toFixed(2),
      },
      items,
    };
  }

  // ============================================================
  // RECONCILIATION RANGE
  // ============================================================

  static async getReconciliationRange(from: string, to: string): Promise<ReconciliationRangeResult> {
    validateDateRange(from, to);

    const businessSettings = await SettingsRepository.getBusinessSettings();
    const rows = await AnalyticsRepository.getReconciliationRange(from, to);

    let totalCashSales = new Decimal(0);
    let totalUpiSales = new Decimal(0);
    let totalCardSales = new Decimal(0);
    let totalExpenses = new Decimal(0);
    let totalPurchases = new Decimal(0);
    let closedDays = 0;
    let mismatchedDays = 0;
    let openDays = 0;

    const days: ReconciliationDayRow[] = rows.map((r: any) => {
      const cashSales = toDecimal(r.cash_sales ?? '0');
      const upiSales = toDecimal(r.upi_sales ?? '0');
      const cardSales = toDecimal(r.card_sales ?? '0');
      const cashExpenses = toDecimal(r.cash_expenses ?? '0');
      const cashPurchases = toDecimal(r.cash_purchases ?? '0');
      const openingCash = toDecimal(r.opening_cash ?? '0');
      const expectedClosingCash = openingCash.plus(cashSales).minus(cashExpenses).minus(cashPurchases);

      totalCashSales = totalCashSales.plus(cashSales);
      totalUpiSales = totalUpiSales.plus(upiSales);
      totalCardSales = totalCardSales.plus(cardSales);
      totalExpenses = totalExpenses.plus(cashExpenses);
      totalPurchases = totalPurchases.plus(cashPurchases);

      const status = r.status ?? 'OPEN';
      if (status === 'CLOSED') closedDays++;
      else if (status === 'MISMATCHED') mismatchedDays++;
      else openDays++;

      const businessDateStr = typeof r.business_date === 'string'
        ? r.business_date.substring(0, 10)
        : new Date(r.business_date).toISOString().substring(0, 10);

      return {
        businessDate: businessDateStr,
        openingCash: toDecimal(r.opening_cash ?? '0').toFixed(2),
        cashSales: cashSales.toFixed(2),
        cashExpenses: cashExpenses.toFixed(2),
        cashPurchases: cashPurchases.toFixed(2),
        expectedClosingCash: expectedClosingCash.toFixed(2),
        actualCash: r.actual_cash !== null ? toDecimal(r.actual_cash).toFixed(2) : null,
        cashDifference: r.cash_difference !== null ? toDecimal(r.cash_difference).toFixed(2) : null,
        upiSales: upiSales.toFixed(2),
        upiSettlement: r.upi_settlement !== null ? toDecimal(r.upi_settlement).toFixed(2) : null,
        upiDifference: r.upi_difference !== null ? toDecimal(r.upi_difference).toFixed(2) : null,
        cardSales: cardSales.toFixed(2),
        cardSettlement: r.card_settlement !== null ? toDecimal(r.card_settlement).toFixed(2) : null,
        cardDifference: r.card_difference !== null ? toDecimal(r.card_difference).toFixed(2) : null,
        status,
      };
    });

    return {
      reportType: 'RECONCILIATION',
      dateRange: { from, to },
      reportedAt: getReportedAt(),
      cafeIdentity: {
        cafeName: businessSettings.cafe_name,
        currency: businessSettings.currency,
      },
      timezone: getTimezone(),
      summary: {
        totalDays: days.length,
        closedDays,
        mismatchedDays,
        openDays,
        totalCashSales: totalCashSales.toFixed(2),
        totalUpiSales: totalUpiSales.toFixed(2),
        totalCardSales: totalCardSales.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        totalPurchases: totalPurchases.toFixed(2),
      },
      days,
    };
  }

  // ============================================================
  // MONTHLY P&L
  // ============================================================

  static async getMonthlyPnl(from: string, to: string): Promise<MonthlyPnlResult> {
    validateDateRange(from, to);

    const businessSettings = await SettingsRepository.getBusinessSettings();

    const [
      monthlyBills,
      monthlyFoodCost,
      monthlyCoverage,
      monthlyExpenses,
    ] = await Promise.all([
      AnalyticsRepository.getMonthlyBillsSummary(from, to),
      AnalyticsRepository.getMonthlyFoodCost(from, to),
      AnalyticsRepository.getMonthlyCoverage(from, to),
      AnalyticsRepository.getMonthlyExpenses(from, to),
    ]);

    // Build lookup maps by year_month
    const foodCostByMonth = new Map(monthlyFoodCost.map((r: any) => [r.year_month, r]));
    const coverageByMonth = new Map(monthlyCoverage.map((r: any) => [r.year_month, r]));
    const expensesByMonth = new Map(monthlyExpenses.map((r: any) => [r.year_month, r]));

    // Collect all distinct months
    const allMonths = new Set<string>([
      ...monthlyBills.map((r: any) => r.year_month),
      ...monthlyFoodCost.map((r: any) => r.year_month),
      ...monthlyExpenses.map((r: any) => r.year_month),
    ]);
    const sortedMonths = Array.from(allMonths).sort();

    let totGrossRevenue = new Decimal(0);
    let totNetSales = new Decimal(0);
    let totFoodCost = new Decimal(0);
    let totGrossProfit = new Decimal(0);
    let totOpEx = new Decimal(0);
    let totNetProfit = new Decimal(0);

    const months: MonthlyPnlRow[] = sortedMonths.map((ym) => {
      const billRow = monthlyBills.find((r: any) => r.year_month === ym);
      const fcRow = foodCostByMonth.get(ym);
      const covRow = coverageByMonth.get(ym);
      const exRow = expensesByMonth.get(ym);

      const grossRevenue = toDecimal(billRow?.gross_revenue ?? '0');
      const totalDiscounts = toDecimal(billRow?.total_discount ?? '0');
      const totalTax = toDecimal(billRow?.total_tax ?? '0');
      const netSales = grossRevenue.minus(totalDiscounts).minus(totalTax);
      const foodCost = toDecimal(fcRow?.food_cost ?? '0');
      const grossProfit = netSales.minus(foodCost);
      const operatingExpenses = toDecimal(exRow?.total_expenses ?? '0');
      const netProfit = grossProfit.minus(operatingExpenses);
      const foodCostPercent = netSales.isZero() ? null : foodCost.dividedBy(netSales).times(100).toFixed(2);

      totGrossRevenue = totGrossRevenue.plus(grossRevenue);
      totNetSales = totNetSales.plus(netSales);
      totFoodCost = totFoodCost.plus(foodCost);
      totGrossProfit = totGrossProfit.plus(grossProfit);
      totOpEx = totOpEx.plus(operatingExpenses);
      totNetProfit = totNetProfit.plus(netProfit);

      const totalBillLines = parseInt(covRow?.total_bill_lines ?? '0', 10);
      const coveredLines = parseInt(covRow?.covered_lines ?? '0', 10);
      const missingCostLines = parseInt(covRow?.missing_cost_lines ?? '0', 10);
      const negativeStockExceptionCount = parseInt(covRow?.negative_stock_exception_count ?? '0', 10);
      const completenessStatus = classifyCompleteness(
        totalBillLines, coveredLines, missingCostLines, negativeStockExceptionCount,
      );

      return {
        yearMonth: ym,
        grossRevenue: grossRevenue.toFixed(2),
        totalDiscounts: totalDiscounts.toFixed(2),
        totalTax: totalTax.toFixed(2),
        netSales: netSales.toFixed(2),
        foodCost: foodCost.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        operatingExpenses: operatingExpenses.toFixed(2),
        configuredWastageExpenseImpact: null, // Schema limitation: unavailable
        netProfit: netProfit.toFixed(2),
        foodCostPercent,
        billCount: parseInt(billRow?.bill_count ?? '0', 10),
        completenessStatus,
      };
    });

    return {
      reportType: 'MONTHLY_PNL',
      dateRange: { from, to },
      reportedAt: getReportedAt(),
      cafeIdentity: {
        cafeName: businessSettings.cafe_name,
        currency: businessSettings.currency,
      },
      timezone: getTimezone(),
      months,
      totals: {
        grossRevenue: totGrossRevenue.toFixed(2),
        netSales: totNetSales.toFixed(2),
        foodCost: totFoodCost.toFixed(2),
        grossProfit: totGrossProfit.toFixed(2),
        operatingExpenses: totOpEx.toFixed(2),
        configuredWastageExpenseImpact: null, // Schema limitation: unavailable
        netProfit: totNetProfit.toFixed(2),
      },
      dataLimitations: [
        'Configured wastage/adjustment monetary expense impact is unavailable in the frozen schema. Therefore, configuredWastageExpenseImpact is null.',
      ],
    };
  }
}
