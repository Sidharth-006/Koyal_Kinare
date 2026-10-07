// analytics.types.ts — Phase 3 Module 4
// All TypeScript interfaces for P&L, completeness, analytics, and report responses.

/**
 * Implementation's deterministic classification rule derived from available DLD metrics.
 * Note: This is the implementation's deterministic classification rule derived from available
 * DLD metrics, not an explicit threshold prescribed by the DLD specification.
 * - INSUFFICIENT_DATA: totalBillLines === 0 OR coveredLines === 0
 * - COMPLETE: 100% recipe coverage (coveredLines === totalBillLines) AND missingCostLines === 0 AND negativeStockExceptionCount === 0
 * - PARTIAL: otherwise
 */
export type CompletenessStatus = 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT_DATA';

export interface PnlCompletenessModel {
  totalBillLines: number;
  coveredLines: number;
  missingRecipeLines: number;
  missingCostLines: number;
  negativeStockExceptionCount: number;
  recipeCoveragePercent: string | null;
  missingRecipeSalesAmount: string;
  missingCostAmount: string;
  completenessStatus: CompletenessStatus;
}

export interface BreakEvenResult {
  breakEvenAmount: string | null;
  fixedCosts: string | null;
  targetGrossMarginRate: string | null;
  reason: string | null;
  message?: string | null;
}

export interface WastageIndicators {
  wastageCount: number;
  wastageQuantity: string;
  countCorrectionDeficitCount: number;
  countCorrectionDeficitQuantity: string;
}

export interface PnlResult {
  reportType: 'PNL';
  dateRange: { from: string; to: string };
  reportedAt: string;
  cafeIdentity: { cafeName: string; currency: string };
  timezone: string;
  grossRevenue: string;
  totalDiscounts: string;
  totalTax: string;
  netSales: string;
  foodCost: string;
  grossProfit: string;
  operatingExpenses: string;
  configuredWastageExpenseImpact: null; // MUST be null ONLY, never "0.00"
  netProfit: string;
  foodCostPercent: string | null;
  billCount: number;
  completeness: PnlCompletenessModel;
  breakEven: BreakEvenResult;
  paymentSplits: { CASH: string; UPI: string; CARD: string };
  wastageIndicators: WastageIndicators;
  dataLimitations: string[];
}

export interface AnalyticsOverviewResult {
  reportType: 'ANALYTICS_OVERVIEW';
  dateRange: { from: string; to: string };
  reportedAt: string;
  cafeIdentity: { cafeName: string; currency: string };
  timezone: string;
  revenue: {
    grossRevenue: string;
    netSales: string;
    totalDiscount: string;
    totalTax: string;
    billCount: number;
    averageOrderValue: string;
  };
  paymentSplits: { CASH: string; UPI: string; CARD: string };
  expenses: {
    total: string;
    byCategory: Array<{ category: string; total: string }>;
  };
  foodCost: {
    total: string;
    coveragePercent: string | null;
    completenessStatus: CompletenessStatus;
  };
  profitability: {
    grossProfit: string;
    netProfit: string;
    foodCostPercent: string | null;
  };
  operationalExceptions: {
    missingRecipeLines: number;
    missingCostLines: number;
    negativeStockOverrideBills: number;
    voidedBillCount: number;
  };
  wastageIndicators: WastageIndicators;
  dataLimitations: string[];
}

export interface MenuPerformanceItem {
  menuItemId: string | null;
  itemName: string;
  categoryName: string;
  totalQuantity: number;
  totalRevenue: string;
  foodCost: string | null;
  grossMargin: string | null;
  grossMarginPercent: string | null;
  foodCostPercent: string | null;
  hasCostData: boolean;
  completenessStatus: CompletenessStatus;
}

export interface MenuPerformanceResult {
  reportType: 'MENU_PERFORMANCE';
  dateRange: { from: string; to: string };
  reportedAt: string;
  cafeIdentity: { cafeName: string; currency: string };
  timezone: string;
  appliedSort: string;
  items: MenuPerformanceItem[];
  summary: {
    totalItems: number;
    itemsWithCostData: number;
    itemsWithoutCostData: number;
  };
}

export const VALID_MENU_PERFORMANCE_SORTS = [
  'revenue',
  'quantity',
  'food_cost',
  'gross_margin',
  'food_cost_percent',
] as const;

export type MenuPerformanceSortKey = typeof VALID_MENU_PERFORMANCE_SORTS[number];

// ==================== REGISTER TYPES ====================

export interface SalesRegisterRow {
  billId: string;
  billNumber: string;
  businessDate: string;
  orderType: string;
  subtotal: string;
  discount: string;
  tax: string;
  grandTotal: string;
  taxRateSnapshot: string | null;
  payments: Array<{ method: string; amount: string }>;
  status: string;
  completedAt: string;
}

export interface SalesRegisterResult {
  reportType: 'SALES_REGISTER';
  dateRange: { from: string; to: string };
  reportedAt: string;
  cafeIdentity: { cafeName: string; currency: string };
  timezone: string;
  summary: {
    totalBills: number;
    completedBills: number;
    voidedBills: number;
    totalGrossRevenue: string;
    totalDiscounts: string;
    totalTax: string;
    totalNetSales: string;
  };
  items: SalesRegisterRow[];
}

export interface PurchaseRegisterRow {
  purchaseId: string;
  purchaseNumber: string;
  supplierName: string;
  invoiceNumber: string | null;
  purchaseDate: string;
  paymentMethod: string;
  discount: string;
  taxAmount: string;
  taxRateSnapshot: string | null;
  grandTotal: string;
  status: string;
  receivedAt: string | null;
}

export interface PurchaseRegisterResult {
  reportType: 'PURCHASE_REGISTER';
  dateRange: { from: string; to: string };
  reportedAt: string;
  cafeIdentity: { cafeName: string; currency: string };
  timezone: string;
  summary: {
    totalPurchases: number;
    receivedTotal: string;
    taxTotal: string;
    discountTotal: string;
  };
  items: PurchaseRegisterRow[];
}

export interface ExpenseRegisterRow {
  expenseId: string;
  businessDate: string;
  category: string;
  amount: string;
  paymentMethod: string;
  description: string;
  attachmentRef: string | null;
  isVoided: boolean;
  voidReason: string | null;
  createdAt: string;
}

export interface ExpenseRegisterResult {
  reportType: 'EXPENSE_REGISTER';
  dateRange: { from: string; to: string };
  reportedAt: string;
  cafeIdentity: { cafeName: string; currency: string };
  timezone: string;
  summary: {
    totalExpenses: number;
    activeTotal: string;
    voidedCount: number;
    byCategory: Array<{ category: string; total: string }>;
  };
  items: ExpenseRegisterRow[];
}

export interface MonthlyPnlRow {
  yearMonth: string;
  grossRevenue: string;
  totalDiscounts: string;
  totalTax: string;
  netSales: string;
  foodCost: string;
  grossProfit: string;
  operatingExpenses: string;
  configuredWastageExpenseImpact: null;
  netProfit: string;
  foodCostPercent: string | null;
  billCount: number;
  completenessStatus: CompletenessStatus;
}

export interface MonthlyPnlResult {
  reportType: 'MONTHLY_PNL';
  dateRange: { from: string; to: string };
  reportedAt: string;
  cafeIdentity: { cafeName: string; currency: string };
  timezone: string;
  months: MonthlyPnlRow[];
  totals: {
    grossRevenue: string;
    netSales: string;
    foodCost: string;
    grossProfit: string;
    operatingExpenses: string;
    configuredWastageExpenseImpact: null;
    netProfit: string;
  };
  dataLimitations: string[];
}

export interface InventoryValuationRow {
  itemId: string;
  itemName: string;
  itemType: string;
  baseUnit: string;
  currentQuantity: string;
  averageUnitCost: string | null;
  totalValue: string | null;
  hasWeightedAvgCost: boolean;
}

export interface InventoryValuationResult {
  reportType: 'INVENTORY_VALUATION';
  asOfDate: string;
  reportedAt: string;
  cafeIdentity: { cafeName: string; currency: string };
  timezone: string;
  dataLimitation: string;
  summary: {
    totalItems: number;
    costedItems: number;
    uncostedItems: number;
    totalValuation: string;
  };
  items: InventoryValuationRow[];
}

export interface ReconciliationDayRow {
  businessDate: string;
  openingCash: string;
  cashSales: string;
  cashExpenses: string;
  cashPurchases: string;
  expectedClosingCash: string;
  actualCash: string | null;
  cashDifference: string | null;
  upiSales: string;
  upiSettlement: string | null;
  upiDifference: string | null;
  cardSales: string;
  cardSettlement: string | null;
  cardDifference: string | null;
  status: string;
}

export interface ReconciliationRangeResult {
  reportType: 'RECONCILIATION';
  dateRange: { from: string; to: string };
  reportedAt: string;
  cafeIdentity: { cafeName: string; currency: string };
  timezone: string;
  summary: {
    totalDays: number;
    closedDays: number;
    mismatchedDays: number;
    openDays: number;
    totalCashSales: string;
    totalUpiSales: string;
    totalCardSales: string;
    totalExpenses: string;
    totalPurchases: string;
  };
  days: ReconciliationDayRow[];
}
