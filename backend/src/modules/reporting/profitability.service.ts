import { SalesRepository } from '../sales/sales.repository';
import { InventoryReportsRepository } from './inventory-reports.repository';
import { validateDateRange } from './inventory-reports.service';
import { subtractMoney, toDecimal } from '@/shared/money/decimal';
import Decimal from 'decimal.js';

export class ProfitabilityService {
  static async getPhase2Profitability(startDate: string, endDate: string) {
    validateDateRange(startDate, endDate);

    const [
      salesSummary,
      paymentSplitsRaw,
      totalExpenses,
      expensesByCategory,
      purchasesBreakdown,
      stockIndicators
    ] = await Promise.all([
      SalesRepository.getSalesSummary(startDate, endDate),
      SalesRepository.getPaymentSplits(startDate, endDate),
      SalesRepository.getExpensesSummary(startDate, endDate),
      SalesRepository.getExpensesByCategory(startDate, endDate),
      InventoryReportsRepository.getProfitabilityPurchasesBreakdown(startDate, endDate),
      InventoryReportsRepository.getProfitabilityStockIndicators(startDate, endDate)
    ]);

    const totalSales = salesSummary.total_sales || '0.00';
    const totalSubtotal = salesSummary.total_subtotal || '0.00';
    const totalDiscount = salesSummary.total_discount || '0.00';
    const totalTax = salesSummary.total_tax || '0.00';
    const billCount = parseInt(salesSummary.bill_count, 10) || 0;

    const splits = {
      CASH: '0.00',
      UPI: '0.00',
      CARD: '0.00'
    };
    for (const split of paymentSplitsRaw) {
      if (split.payment_method in splits) {
        (splits as any)[split.payment_method] = split.total_amount;
      }
    }

    const totalReceivedPurchases = purchasesBreakdown.total_received_purchases || '0.00';
    const rawMaterialPurchases = purchasesBreakdown.raw_material_total || '0.00';
    const packagingPurchases = purchasesBreakdown.packaging_total || '0.00';
    const otherPurchases = purchasesBreakdown.other_total || '0.00';

    // Phase 1 Net Profit = Revenue - Operating Expenses
    const phase1NetProfit = subtractMoney(totalSales, totalExpenses);

    // Phase 2 Estimated Net Profit = Revenue - Operating Expenses - Received Purchases
    const phase2EstimatedNetProfit = subtractMoney(phase1NetProfit, totalReceivedPurchases);

    return {
      startDate,
      endDate,
      revenue: {
        totalSales,
        totalSubtotal,
        totalDiscount,
        totalTax,
        billCount,
        paymentSplits: splits
      },
      operatingExpenses: {
        totalExpenses,
        byCategory: expensesByCategory
      },
      purchases: {
        totalPurchases: totalReceivedPurchases,
        rawMaterialPurchases,
        packagingPurchases,
        otherPurchases
      },
      wastageIndicators: {
        wastageMovementCount: stockIndicators.wastage_count || 0,
        wastageTotalQuantity: String(stockIndicators.wastage_quantity || '0.000'),
        manualDecreaseCount: stockIndicators.manual_decrease_count || 0,
        manualDecreaseQuantity: String(stockIndicators.manual_decrease_quantity || '0.000'),
        countCorrectionDeficitCount: stockIndicators.count_correction_deficit_count || 0,
        countCorrectionDeficitQuantity: String(stockIndicators.count_correction_deficit_quantity || '0.000')
      },
      manualConsumptionIndicators: {
        manualConsumptionCount: stockIndicators.manual_consumption_count || 0,
        manualConsumptionQuantity: String(stockIndicators.manual_consumption_quantity || '0.000')
      },
      financialSummary: {
        totalRevenue: totalSales,
        totalOperatingExpenses: totalExpenses,
        totalReceivedPurchases,
        phase1NetProfit,
        phase2EstimatedNetProfit
      },
      isEstimate: true,
      estimationDisclaimer: 'Phase 2 profitability reflects cash/accrued inventory purchases during this period and is not a recipe-costed COGS (scheduled for Phase 3).'
    };
  }
}
