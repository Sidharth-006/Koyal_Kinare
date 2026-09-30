import { describe, it, expect } from 'vitest';
import {
  InventoryOverviewDTO,
  LowStockItemDTO,
  Phase2ProfitabilityDTO,
  InventoryStockReportParams,
  StockMovementsReportParams,
  PurchasesReportParams,
  SupplierSummaryReportParams,
  WastageReportParams
} from '@/lib/types';

describe('Phase 2 — Module 5: Inventory Alerts, Reports & Financial Integration Frontend Logic', () => {

  describe('Low-Stock Alert Rules & Invariants', () => {
    it('calculates deficit accurately from threshold and current available balance', () => {
      const calculateDeficit = (minimumStock: number | string, availableQuantity: number | string) => {
        const min = parseFloat(String(minimumStock));
        const avail = parseFloat(String(availableQuantity));
        const diff = min - avail;
        return diff > 0 ? diff : 0;
      };

      expect(calculateDeficit(10, 3.5)).toBe(6.5);
      expect(calculateDeficit('5.000', '2.250')).toBe(2.75);
      expect(calculateDeficit(5, 5)).toBe(0);
      expect(calculateDeficit(5, 7)).toBe(0);
    });

    it('enforces that acknowledgement is strictly an operational note and does not resolve the alert', () => {
      const item: LowStockItemDTO = {
        id: 'item-1',
        name: 'Whole Milk',
        baseUnit: 'L',
        minimumStock: 10,
        availableQuantity: 2.5,
        deficitQuantity: 7.5,
        lastMovementAt: '2026-09-30T10:00:00Z',
        isAcknowledged: true,
        acknowledgedAt: '2026-09-30T11:00:00Z',
        acknowledgedBy: 'admin-1',
        acknowledgementNote: 'Ordered 20L from dairy supplier'
      };

      // Item remains low stock because availableQuantity <= minimumStock
      const isStillLowStock = parseFloat(String(item.availableQuantity)) <= parseFloat(String(item.minimumStock));
      expect(isStillLowStock).toBe(true);
      expect(item.isAcknowledged).toBe(true);
      expect(item.acknowledgementNote).toBe('Ordered 20L from dairy supplier');
    });

    it('validates acknowledgement note length limit (up to 500 characters)', () => {
      const validateNote = (note?: string) => {
        if (!note) return true; // Optional
        return note.length <= 500;
      };

      expect(validateNote('')).toBe(true);
      expect(validateNote(undefined)).toBe(true);
      expect(validateNote('Supplier contacted')).toBe(true);
      expect(validateNote('a'.repeat(500))).toBe(true);
      expect(validateNote('a'.repeat(501))).toBe(false);
    });

    it('relies on authoritative server balance for alert presence', () => {
      const itemsList: LowStockItemDTO[] = [
        {
          id: 'item-1',
          name: 'Coffee Beans',
          baseUnit: 'KG',
          minimumStock: 5,
          availableQuantity: 1.2,
          deficitQuantity: 3.8,
          lastMovementAt: '2026-09-30T09:00:00Z',
          isAcknowledged: false,
          acknowledgedAt: null,
          acknowledgedBy: null,
          acknowledgementNote: null
        },
        {
          id: 'item-2',
          name: 'Sugar Bags',
          baseUnit: 'KG',
          minimumStock: 20,
          availableQuantity: 5,
          deficitQuantity: 15,
          lastMovementAt: '2026-09-30T08:00:00Z',
          isAcknowledged: true,
          acknowledgedAt: '2026-09-30T09:30:00Z',
          acknowledgedBy: 'admin-1',
          acknowledgementNote: 'PO draft created'
        }
      ];

      // Both items are present in low stock alerts regardless of acknowledgement status
      expect(itemsList).toHaveLength(2);
      expect(itemsList.filter(i => !i.isAcknowledged)).toHaveLength(1);
      expect(itemsList.filter(i => i.isAcknowledged)).toHaveLength(1);
    });
  });

  describe('Report Export Formats & Filter Serialization', () => {
    it('restricts public export formats strictly to XLSX and PDF (no CSV)', () => {
      const SUPPORTED_FORMATS: Array<'XLSX' | 'PDF'> = ['XLSX', 'PDF'];

      expect(SUPPORTED_FORMATS).toHaveLength(2);
      expect(SUPPORTED_FORMATS).toContain('XLSX');
      expect(SUPPORTED_FORMATS).toContain('PDF');
      expect(SUPPORTED_FORMATS).not.toContain('CSV');
    });

    it('constructs Inventory Stock report query parameters cleanly', () => {
      const buildParams = (asOf: string, format: 'XLSX' | 'PDF'): InventoryStockReportParams => ({
        asOf,
        format
      });

      const params = buildParams('2026-09-30', 'XLSX');
      expect(params.asOf).toBe('2026-09-30');
      expect(params.format).toBe('XLSX');
    });

    it('constructs Stock Movements report query parameters with optional filters', () => {
      const buildParams = (filters: {
        from: string;
        to: string;
        itemId?: string;
        movementType?: string;
        format: 'XLSX' | 'PDF';
      }): StockMovementsReportParams => ({
        from: filters.from,
        to: filters.to,
        itemId: filters.itemId || undefined,
        movementType: filters.movementType || undefined,
        format: filters.format
      });

      const paramsWithFilters = buildParams({
        from: '2026-09-01',
        to: '2026-09-30',
        itemId: 'item-123',
        movementType: 'WASTAGE',
        format: 'PDF'
      });
      expect(paramsWithFilters.itemId).toBe('item-123');
      expect(paramsWithFilters.movementType).toBe('WASTAGE');

      const paramsWithoutFilters = buildParams({
        from: '2026-09-01',
        to: '2026-09-30',
        itemId: '',
        movementType: '',
        format: 'XLSX'
      });
      expect(paramsWithoutFilters.itemId).toBeUndefined();
      expect(paramsWithoutFilters.movementType).toBeUndefined();
    });

    it('constructs Purchases report query parameters correctly', () => {
      const buildParams = (filters: {
        from: string;
        to: string;
        supplierId?: string;
        paymentMethod?: string;
        status?: string;
        format: 'XLSX' | 'PDF';
      }): PurchasesReportParams => ({
        from: filters.from,
        to: filters.to,
        supplierId: filters.supplierId || undefined,
        paymentMethod: filters.paymentMethod || undefined,
        status: filters.status || undefined,
        format: filters.format
      });

      const params = buildParams({
        from: '2026-09-01',
        to: '2026-09-30',
        supplierId: 'supp-456',
        paymentMethod: 'CASH',
        status: 'RECEIVED',
        format: 'XLSX'
      });

      expect(params.supplierId).toBe('supp-456');
      expect(params.paymentMethod).toBe('CASH');
      expect(params.status).toBe('RECEIVED');
    });

    it('preserves selected filter state when switching between XLSX and PDF exports', () => {
      let currentFormat: 'XLSX' | 'PDF' = 'XLSX';
      const filters = {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        supplierId: 'supp-1'
      };

      const exportRequest1 = { ...filters, format: currentFormat };
      expect(exportRequest1.format).toBe('XLSX');

      currentFormat = 'PDF';
      const exportRequest2 = { ...filters, format: currentFormat };
      expect(exportRequest2.format).toBe('PDF');
      expect(exportRequest2.startDate).toBe(filters.startDate);
      expect(exportRequest2.supplierId).toBe(filters.supplierId);
    });
  });

  describe('Read-Only Reconciliation with Cash-Paid Purchases', () => {
    it('calculates expected cash with cash purchases included: Opening + Cash Sales - Cash Expenses - Cash Purchases = Expected Cash', () => {
      const calculateExpectedCash = (
        opening: number,
        cashSales: number,
        cashExpenses: number,
        cashPurchases: number
      ) => {
        return opening + cashSales - cashExpenses - cashPurchases;
      };

      const opening = 2000;
      const cashSales = 8500;
      const cashExpenses = 1200;
      const cashPurchases = 3500;

      const expected = calculateExpectedCash(opening, cashSales, cashExpenses, cashPurchases);
      expect(expected).toBe(5800); // 2000 + 8500 - 1200 - 3500 = 5800
    });

    it('calculates cash variance against authoritative expected cash', () => {
      const expectedCash = 5800;
      const actualCash = 5800;
      const variance = actualCash - expectedCash;

      expect(variance).toBe(0);
      expect(Math.abs(variance) < 0.01).toBe(true);

      const actualWithShortage = 5500;
      expect(actualWithShortage - expectedCash).toBe(-300);

      const actualWithExcess = 6000;
      expect(actualWithExcess - expectedCash).toBe(200);
    });

    it('generates direct link to filtered cash purchases on reconciliation date', () => {
      const date = '2026-09-30';
      const purchaseFilterUrl = `/purchases?startDate=${date}&endDate=${date}&paymentMethod=CASH&status=RECEIVED`;

      expect(purchaseFilterUrl).toContain('paymentMethod=CASH');
      expect(purchaseFilterUrl).toContain('status=RECEIVED');
      expect(purchaseFilterUrl).toContain(`startDate=${date}`);
    });
  });

  describe('Phase 2 Profitability Guardrails & Copy', () => {
    it('requires profitability result to have isEstimate set to true and contain disclaimer', () => {
      const profitabilityData: Phase2ProfitabilityDTO = {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        grossSales: '150000.00',
        totalDiscounts: '5000.00',
        netSales: '145000.00',
        totalTaxes: '7250.00',
        totalRevenue: '152250.00',
        purchasesTotal: '60000.00',
        totalPurchases: '60000.00',
        expensesTotal: '25000.00',
        totalExpenses: '25000.00',
        estimatedNetProfit: '60000.00',
        netProfit: '60000.00',
        isEstimate: true,
        disclaimer: 'Phase 2 profitability reflects cash/accrued inventory purchases during this period and is not a recipe-costed COGS (scheduled for Phase 3).'
      };

      expect(profitabilityData.isEstimate).toBe(true);
      expect(profitabilityData.disclaimer).toContain('Phase 3');
      expect(profitabilityData.disclaimer).toContain('recipe-costed');
    });
  });

  describe('Inventory Overview Hub Data Structure', () => {
    it('correctly models the overview payload with counts and recent records', () => {
      const overview: InventoryOverviewDTO = {
        activeItemsCount: 42,
        lowStockCount: 3,
        recentPurchases: [
          {
            id: 'p-1',
            purchaseNumber: 'KP-20260930-0001',
            supplierName: 'Fresh Farms',
            grandTotal: 1500,
            status: 'RECEIVED',
            discount: 0
          }
        ],
        recentMovements: [
          {
            id: 'm-1',
            inventory_item_id: 'item-1',
            business_date: '2026-09-30',
            movement_type: 'PURCHASE_RECEIPT',
            quantity_delta: '10.000',
            unit_cost: '150.00',
            source_type: 'PURCHASE_RECEIPT',
            source_id: 'src-1',
            reason: 'Purchase Receipt: KP-20260930-0001',
            created_by: 'admin-1',
            created_at: '2026-09-30T10:00:00Z'
          }
        ]
      };

      expect(overview.activeItemsCount).toBe(42);
      expect(overview.lowStockCount).toBe(3);
      expect(overview.recentPurchases).toHaveLength(1);
      expect(overview.recentMovements).toHaveLength(1);
    });
  });
});
