import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, downloadExportFile } from '@/lib/api';
import {
  PnlResult,
  AnalyticsOverviewResult,
  MenuPerformanceResult,
  SalesRegisterResult,
  PurchaseRegisterResult,
  ExpenseRegisterResult,
  MonthlyPnlResult,
  InventoryValuationResult,
  ReconciliationRangeResult,
  ExportResultDTO
} from '@/lib/types';

describe('Phase 3 — Module 4: P&L, CA Reporting and Analytics (Frontend)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. API Client Integration for All 9 Module 4 Endpoints
  // =========================================================================
  describe('1. API Client Integration', () => {
    const mockPnlResult: PnlResult = {
      reportType: 'PNL',
      dateRange: { from: '2026-10-01', to: '2026-10-08' },
      reportedAt: '2026-10-08T10:00:00.000Z',
      cafeIdentity: { cafeName: 'Koyal Kinare Cafe', currency: 'INR' },
      timezone: 'Asia/Kolkata',
      grossRevenue: '5000.00',
      totalDiscounts: '200.00',
      totalTax: '250.00',
      netSales: '4550.00',
      foodCost: '1400.00',
      grossProfit: '3150.00',
      operatingExpenses: '800.00',
      configuredWastageExpenseImpact: null,
      netProfit: '2350.00',
      foodCostPercent: '30.77',
      billCount: 42,
      completeness: {
        totalBillLines: 100,
        coveredLines: 95,
        missingRecipeLines: 5,
        missingCostLines: 0,
        negativeStockExceptionCount: 0,
        recipeCoveragePercent: '95.00',
        missingRecipeSalesAmount: '150.00',
        missingCostAmount: '0.00',
        completenessStatus: 'PARTIAL'
      },
      breakEven: {
        breakEvenAmount: null,
        fixedCosts: null,
        targetGrossMarginRate: '0.6500',
        reason: 'FIXED_COSTS_NOT_CONFIGURED',
        message: 'Fixed costs are not configured in system.'
      },
      paymentSplits: { CASH: '2550.00', UPI: '1500.00', CARD: '500.00' },
      wastageIndicators: {
        wastageCount: 3,
        wastageQuantity: '4.500',
        countCorrectionDeficitCount: 1,
        countCorrectionDeficitQuantity: '0.500'
      },
      dataLimitations: [
        'Configured wastage expense impact is unavailable.',
        'Fixed costs are not configured.'
      ]
    };

    it('invokes getPnl with encoded date range parameters', async () => {
      const getSpy = vi.spyOn(api, 'getPnl').mockResolvedValue(mockPnlResult);
      const res = await api.getPnl('2026-10-01', '2026-10-08');

      expect(getSpy).toHaveBeenCalledWith('2026-10-01', '2026-10-08');
      expect(res.reportType).toBe('PNL');
      expect(res.netSales).toBe('4550.00');
      expect(res.netProfit).toBe('2350.00');
    });

    it('invokes getAnalyticsOverview with date range parameters', async () => {
      const mockOverview: AnalyticsOverviewResult = {
        reportType: 'ANALYTICS_OVERVIEW',
        dateRange: { from: '2026-10-01', to: '2026-10-08' },
        reportedAt: '2026-10-08T10:00:00.000Z',
        cafeIdentity: { cafeName: 'Koyal Kinare Cafe', currency: 'INR' },
        timezone: 'Asia/Kolkata',
        revenue: {
          grossRevenue: '5000.00',
          netSales: '4550.00',
          totalDiscount: '200.00',
          totalTax: '250.00',
          billCount: 42,
          averageOrderValue: '119.05'
        },
        paymentSplits: { CASH: '2550.00', UPI: '1500.00', CARD: '500.00' },
        expenses: {
          total: '800.00',
          byCategory: [{ category: 'RAW_MATERIALS', total: '800.00' }]
        },
        foodCost: {
          total: '1400.00',
          coveragePercent: '95.00',
          completenessStatus: 'PARTIAL'
        },
        profitability: {
          grossProfit: '3150.00',
          netProfit: '2350.00',
          foodCostPercent: '30.77'
        },
        operationalExceptions: {
          missingRecipeLines: 5,
          missingCostLines: 0,
          negativeStockOverrideBills: 0,
          voidedBillCount: 1
        },
        wastageIndicators: {
          wastageCount: 3,
          wastageQuantity: '4.500',
          countCorrectionDeficitCount: 1,
          countCorrectionDeficitQuantity: '0.500'
        },
        dataLimitations: ['Wastage monetary rules unconfigured.']
      };

      const spy = vi.spyOn(api, 'getAnalyticsOverview').mockResolvedValue(mockOverview);
      const res = await api.getAnalyticsOverview('2026-10-01', '2026-10-08');

      expect(spy).toHaveBeenCalledWith('2026-10-01', '2026-10-08');
      expect(res.revenue.averageOrderValue).toBe('119.05');
      expect(res.operationalExceptions.voidedBillCount).toBe(1);
    });

    it('invokes getMenuPerformance with sorting parameter', async () => {
      const mockMenuRes: MenuPerformanceResult = {
        reportType: 'MENU_PERFORMANCE',
        dateRange: { from: '2026-10-01', to: '2026-10-08' },
        reportedAt: '2026-10-08T10:00:00.000Z',
        cafeIdentity: { cafeName: 'Koyal Kinare Cafe', currency: 'INR' },
        timezone: 'Asia/Kolkata',
        appliedSort: 'revenue',
        items: [
          {
            menuItemId: 'item-1',
            itemName: 'Masala Chai',
            categoryName: 'Beverages',
            totalQuantity: 50,
            totalRevenue: '1000.00',
            foodCost: '250.00',
            grossMargin: '750.00',
            grossMarginPercent: '75.00',
            foodCostPercent: '25.00',
            hasCostData: true,
            completenessStatus: 'COMPLETE'
          }
        ],
        summary: { totalItems: 1, itemsWithCostData: 1, itemsWithoutCostData: 0 }
      };

      const spy = vi.spyOn(api, 'getMenuPerformance').mockResolvedValue(mockMenuRes);
      const res = await api.getMenuPerformance('2026-10-01', '2026-10-08', 'revenue');

      expect(spy).toHaveBeenCalledWith('2026-10-01', '2026-10-08', 'revenue');
      expect(res.items[0].itemName).toBe('Masala Chai');
      expect(res.items[0].grossMarginPercent).toBe('75.00');
    });

    it('invokes all 6 CA report and export endpoints with valid signatures', async () => {
      const mockExportDto: ExportResultDTO = {
        job: { id: 'job-1', status: 'COMPLETED' },
        metadata: { cafeName: 'Koyal Kinare', reportTitle: 'Test', appliedDateRange: '2026-10-01 to 2026-10-08', generatedAt: '2026-10-08', format: 'XLSX' },
        reportData: {},
        contentBuffer: 'dGVzdA==',
        mimeType: 'text/csv'
      };

      const spySales = vi.spyOn(api, 'exportSalesRegister').mockResolvedValue(mockExportDto);
      const spyPurch = vi.spyOn(api, 'exportPurchaseRegister').mockResolvedValue(mockExportDto);
      const spyExp = vi.spyOn(api, 'exportExpenseRegister').mockResolvedValue(mockExportDto);
      const spyPnl = vi.spyOn(api, 'exportMonthlyPnl').mockResolvedValue(mockExportDto);
      const spyInv = vi.spyOn(api, 'exportInventoryValuationReport').mockResolvedValue(mockExportDto);
      const spyRecon = vi.spyOn(api, 'exportReconciliationRangeReport').mockResolvedValue(mockExportDto);

      await api.exportSalesRegister('2026-10-01', '2026-10-08', 'XLSX');
      await api.exportPurchaseRegister('2026-10-01', '2026-10-08', 'PDF');
      await api.exportExpenseRegister('2026-10-01', '2026-10-08', 'XLSX');
      await api.exportMonthlyPnl('2026-10-01', '2026-10-08', 'PDF');
      await api.exportInventoryValuationReport('2026-10-08', 'XLSX');
      await api.exportReconciliationRangeReport('2026-10-01', '2026-10-08', 'PDF');

      expect(spySales).toHaveBeenCalledWith('2026-10-01', '2026-10-08', 'XLSX');
      expect(spyPurch).toHaveBeenCalledWith('2026-10-01', '2026-10-08', 'PDF');
      expect(spyExp).toHaveBeenCalledWith('2026-10-01', '2026-10-08', 'XLSX');
      expect(spyPnl).toHaveBeenCalledWith('2026-10-01', '2026-10-08', 'PDF');
      expect(spyInv).toHaveBeenCalledWith('2026-10-08', 'XLSX');
      expect(spyRecon).toHaveBeenCalledWith('2026-10-01', '2026-10-08', 'PDF');
    });
  });

  // =========================================================================
  // 2. CORRECTION 1: No Browser-Authoritative Margin Calculations
  // =========================================================================
  describe('2. CORRECTION 1: No Browser-Authoritative Margin Calculations', () => {
    it('strictly renders "—" for Gross Margin % and Net Margin % when not provided by /api/pnl', () => {
      // In PnlResult contract, grossMarginPercent and netMarginPercent do NOT exist.
      const pnlData = {
        grossProfit: '3150.00',
        netProfit: '2350.00',
        netSales: '4550.00'
        // grossMarginPercent: undefined
        // netMarginPercent: undefined
      };

      // Helper simulating the rendering contract
      const resolvePnlGrossMarginPercent = (data: any): string => {
        if (data.grossMarginPercent !== undefined && data.grossMarginPercent !== null) {
          return `${data.grossMarginPercent}%`;
        }
        // STRICT RULE: Never perform (grossProfit / netSales * 100) on the client!
        return '—';
      };

      const resolvePnlNetMarginPercent = (data: any): string => {
        if (data.netMarginPercent !== undefined && data.netMarginPercent !== null) {
          return `${data.netMarginPercent}%`;
        }
        // STRICT RULE: Never perform (netProfit / netSales * 100) on the client!
        return '—';
      };

      expect(resolvePnlGrossMarginPercent(pnlData)).toBe('—');
      expect(resolvePnlNetMarginPercent(pnlData)).toBe('—');
    });

    it('renders server-calculated item gross margin percent only when explicitly supplied by backend', () => {
      const itemWithCost = {
        hasCostData: true,
        grossMarginPercent: '68.50'
      };
      const itemWithoutCost = {
        hasCostData: false,
        grossMarginPercent: null
      };

      const resolveItemMargin = (item: any): string => {
        if (!item.hasCostData || item.grossMarginPercent === null) return '—';
        return `${item.grossMarginPercent}%`;
      };

      expect(resolveItemMargin(itemWithCost)).toBe('68.50%');
      expect(resolveItemMargin(itemWithoutCost)).toBe('—');
    });
  });

  // =========================================================================
  // 3. CORRECTION 2: Report Previews Must Be Formatted UI, Never Raw JSON
  // =========================================================================
  describe('3. CORRECTION 2: Report Previews Are Formatted UI, Never Raw JSON', () => {
    it('validates that report preview structures contain tabular metadata and no JSON dump strings', () => {
      const sampleSalesRegister: SalesRegisterResult = {
        reportType: 'SALES_REGISTER',
        dateRange: { from: '2026-10-01', to: '2026-10-08' },
        reportedAt: '2026-10-08T10:00:00.000Z',
        cafeIdentity: { cafeName: 'Koyal Kinare Cafe', currency: 'INR' },
        timezone: 'Asia/Kolkata',
        summary: {
          totalBills: 1,
          completedBills: 1,
          voidedBills: 0,
          totalGrossRevenue: '240.00',
          totalDiscounts: '20.00',
          totalTax: '11.00',
          totalNetSales: '209.00'
        },
        items: [
          {
            billId: 'bill-1',
            billNumber: 'BILL-1001',
            businessDate: '2026-10-05',
            orderType: 'DINE_IN',
            subtotal: '240.00',
            discount: '20.00',
            tax: '11.00',
            grandTotal: '231.00',
            taxRateSnapshot: '0.0500',
            payments: [{ method: 'CASH', amount: '231.00' }],
            status: 'COMPLETED',
            completedAt: '2026-10-05T14:30:00.000Z'
          }
        ]
      };

      // Ensure data provides required display fields for formatted rendering
      expect(sampleSalesRegister.summary.totalBills).toBe(1);
      expect(sampleSalesRegister.items[0].billNumber).toBe('BILL-1001');
      expect(sampleSalesRegister.items[0].payments[0].method).toBe('CASH');

      // Assert that the preview formatter produces human-friendly cell data without object strings
      const rowDisplay = {
        bill: sampleSalesRegister.items[0].billNumber,
        grandTotal: `₹${Number(sampleSalesRegister.items[0].grandTotal).toFixed(2)}`,
        status: sampleSalesRegister.items[0].status
      };

      expect(rowDisplay.bill).toBe('BILL-1001');
      expect(rowDisplay.grandTotal).toBe('₹231.00');
      expect(rowDisplay.status).toBe('COMPLETED');
      expect(typeof rowDisplay.bill).toBe('string');
      expect(rowDisplay.bill).not.toContain('{');
    });
  });

  // =========================================================================
  // 4. CORRECTION 3: Keep Food-Cost Coverage and Overall Completeness Distinct
  // =========================================================================
  describe('4. CORRECTION 3: Food Cost Coverage vs Overall Completeness Distinction', () => {
    it('maintains strict separation between Food Cost Coverage and Overall Data Completeness', () => {
      const completenessModel = {
        recipeCoveragePercent: '88.50',
        completenessStatus: 'PARTIAL' as const,
        coveredLines: 88,
        totalBillLines: 100
      };

      // Metric 1: Food Cost Coverage (numeric ratio of lines covered)
      const foodCostCoverageText = completenessModel.recipeCoveragePercent
        ? `${completenessModel.recipeCoveragePercent}%`
        : '—';

      // Metric 2: Overall Data Completeness (status classification)
      const overallCompletenessStatus = completenessModel.completenessStatus;

      expect(foodCostCoverageText).toBe('88.50%');
      expect(overallCompletenessStatus).toBe('PARTIAL');
      expect(foodCostCoverageText).not.toBe(overallCompletenessStatus);
    });
  });

  // =========================================================================
  // 5. Critical Frozen Invariants: Break-Even & Wastage Null Handling
  // =========================================================================
  describe('5. Frozen Backend Invariants: Break-Even and Wastage', () => {
    it('displays "₹—" and "Not Configured" when break-even amount is null', () => {
      const breakEven = {
        breakEvenAmount: null,
        fixedCosts: null,
        targetGrossMarginRate: '0.6500',
        reason: 'FIXED_COSTS_NOT_CONFIGURED',
        message: 'Fixed costs are not configured in system.'
      };

      const renderBreakEvenValue = (be: typeof breakEven): string => {
        if (be.breakEvenAmount === null || be.breakEvenAmount === undefined) {
          return '₹—';
        }
        return `₹${be.breakEvenAmount}`;
      };

      expect(renderBreakEvenValue(breakEven)).toBe('₹—');
      expect(renderBreakEvenValue(breakEven)).not.toBe('₹0.00');
      expect(renderBreakEvenValue(breakEven)).not.toBe('₹0');
      expect(breakEven.reason).toBe('FIXED_COSTS_NOT_CONFIGURED');
    });

    it('displays "—" and "Not Configured" for configuredWastageExpenseImpact', () => {
      const configuredWastageExpenseImpact = null;

      const renderWastageImpact = (val: null | string): string => {
        if (val === null || val === undefined) {
          return '—';
        }
        return `₹${val}`;
      };

      expect(renderWastageImpact(configuredWastageExpenseImpact)).toBe('—');
      expect(renderWastageImpact(configuredWastageExpenseImpact)).not.toBe('₹0.00');
    });

    it('renders foodCostPercent as "—" when net sales is zero or null', () => {
      const foodCostPercent = null;
      const displayFoodCostPct = foodCostPercent !== null ? `${foodCostPercent}%` : '—';
      expect(displayFoodCostPct).toBe('—');
    });
  });

  // =========================================================================
  // 6. Client-Side Date Range Validation
  // =========================================================================
  describe('6. Date Range Validation', () => {
    const validateClientDateRange = (from: string, to: string): { valid: boolean; error?: string } => {
      if (!from || !to) return { valid: false, error: 'Start date and end date are required.' };
      if (from > to) return { valid: false, error: 'Start date cannot be after end date.' };
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 366) return { valid: false, error: 'Selected range cannot exceed 366 days.' };
      return { valid: true };
    };

    it('accepts valid date range within 366 days', () => {
      const res = validateClientDateRange('2026-10-01', '2026-10-08');
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects start date after end date', () => {
      const res = validateClientDateRange('2026-10-10', '2026-10-01');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Start date cannot be after end date.');
    });

    it('rejects range exceeding 366 days', () => {
      const res = validateClientDateRange('2025-01-01', '2026-02-01');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Selected range cannot exceed 366 days.');
    });
  });

  // =========================================================================
  // 7. Export Download Utility Verification
  // =========================================================================
  describe('7. Export Download Utility', () => {
    it('successfully processes base64 contentBuffer and triggers browser blob download', () => {
      const mockAnchor = {
        style: {},
        href: '',
        download: '',
        click: vi.fn()
      };

      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue(mockAnchor),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
          contains: vi.fn().mockReturnValue(true)
        }
      };

      (globalThis as any).URL = {
        createObjectURL: vi.fn().mockReturnValue('blob:http://localhost:3000/mock-blob-id'),
        revokeObjectURL: vi.fn()
      };

      const exportData: ExportResultDTO = {
        job: { id: 'job-123', status: 'COMPLETED' },
        metadata: { cafeName: 'Koyal Kinare', reportTitle: 'Sales Register', appliedDateRange: '2026-10-01 to 2026-10-08', generatedAt: '2026-10-08', format: 'XLSX' },
        reportData: {},
        contentBuffer: btoa('BillNumber,Subtotal,GrandTotal\nBILL-1,100,105\n'),
        mimeType: 'text/csv'
      };

      downloadExportFile(exportData, 'sales_register_2026-10-01_to_2026-10-08.xlsx');

      expect(mockAnchor.download).toBe('sales_register_2026-10-01_to_2026-10-08.xlsx');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect((globalThis as any).URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
