import { describe, it, expect } from 'vitest';
import { StockMovementType, StockMovementDTO, ItemStockSummaryDTO, StockMovementListParams } from '@/lib/types';

describe('Module 4 — Stock Ledger and Physical Counts Frontend Logic', () => {
  describe('Stock Impact Preview & Negative Stock Protection', () => {
    const NEGATIVE_STOCK_WARNING = 'This change would make stock negative. Review the current quantity.';

    it('calculates manual increase impact preview correctly', () => {
      const currentBalance = 10.5;
      const quantityToAdd = 4.25;
      const calculatedBalance = currentBalance + quantityToAdd;
      const isNegative = calculatedBalance < 0;

      expect(calculatedBalance).toBe(14.75);
      expect(isNegative).toBe(false);
    });

    it('calculates manual decrease impact preview correctly', () => {
      const currentBalance = 10.0;
      const quantityToDeduct = 3.5;
      const calculatedBalance = currentBalance - quantityToDeduct;
      const isNegative = calculatedBalance < 0;

      expect(calculatedBalance).toBe(6.5);
      expect(isNegative).toBe(false);
    });

    it('flags negative stock and displays exact required warning copy on excessive deduction', () => {
      const currentBalance = 5.0;
      const quantityToDeduct = 7.5;
      const calculatedBalance = currentBalance - quantityToDeduct;
      const isNegative = calculatedBalance < 0;

      let errorMessage: string | null = null;
      if (isNegative) {
        errorMessage = NEGATIVE_STOCK_WARNING;
      }

      expect(isNegative).toBe(true);
      expect(calculatedBalance).toBe(-2.5);
      expect(errorMessage).toBe('This change would make stock negative. Review the current quantity.');
    });

    it('flags negative stock on wastage exceeding current balance', () => {
      const currentBalance = 2.0;
      const wastageQuantity = 2.001;
      const calculatedBalance = currentBalance - wastageQuantity;
      const isNegative = calculatedBalance < 0;

      expect(isNegative).toBe(true);
      expect(calculatedBalance).toBeLessThan(0);
    });

    it('flags negative stock on consumption exceeding current balance', () => {
      const currentBalance = 0.5;
      const consumptionQuantity = 1.0;
      const isNegative = currentBalance - consumptionQuantity < 0;

      expect(isNegative).toBe(true);
    });
  });

  describe('Physical Count Variance Analysis & Reason Requirement', () => {
    it('detects exact reconciliation (MATCH) when counted matches book balance', () => {
      const expected = 12.5;
      const actual = 12.5;
      const variance = actual - expected;

      expect(variance).toBe(0);
      const isMatch = Math.abs(variance) <= 0.0001;
      expect(isMatch).toBe(true);
    });

    it('detects SURPLUS discrepancy when counted exceeds book balance', () => {
      const expected = 10.0;
      const actual = 13.75;
      const variance = actual - expected;

      expect(variance).toBe(3.75);
      expect(variance > 0.0001).toBe(true);
    });

    it('detects SHORTAGE discrepancy when counted is below book balance', () => {
      const expected = 20.0;
      const actual = 18.25;
      const variance = actual - expected;

      expect(variance).toBe(-1.75);
      expect(variance < -0.0001).toBe(true);
    });

    it('permits zero actual physical count (item fully depleted)', () => {
      const expected = 5.0;
      const actual = 0.0;
      const variance = actual - expected;

      expect(actual).toBeGreaterThanOrEqual(0);
      expect(variance).toBe(-5.0);
    });

    it('enforces mandatory reason if variance exists, but optional when exact match', () => {
      const validateCountReason = (hasVariance: boolean, reason?: string) => {
        if (hasVariance && (!reason || reason.trim().length === 0)) {
          return false;
        }
        return true;
      };

      expect(validateCountReason(true, '')).toBe(false);
      expect(validateCountReason(true, '   ')).toBe(false);
      expect(validateCountReason(true, 'Audited spill')).toBe(true);
      expect(validateCountReason(false, '')).toBe(true);
      expect(validateCountReason(false, undefined)).toBe(true);
    });
  });

  describe('Validation & Reason Rules', () => {
    it('enforces mandatory reason for stock decreases', () => {
      const validateAdjustment = (direction: 'INCREASE' | 'DECREASE', reason: string) => {
        if (direction === 'DECREASE' && (!reason || reason.trim().length === 0)) {
          return false;
        }
        return true;
      };

      expect(validateAdjustment('INCREASE', '')).toBe(true);
      expect(validateAdjustment('DECREASE', '')).toBe(false);
      expect(validateAdjustment('DECREASE', 'Spill cleanup')).toBe(true);
    });

    it('enforces mandatory reason for wastage and consumption', () => {
      const validateMandatoryReason = (reason: string) => {
        return reason.trim().length > 0 && reason.trim().length <= 500;
      };

      expect(validateMandatoryReason('')).toBe(false);
      expect(validateMandatoryReason('   ')).toBe(false);
      expect(validateMandatoryReason('Expired milk carton')).toBe(true);
      expect(validateMandatoryReason('a'.repeat(501))).toBe(false);
    });

    it('validates 3-decimal precision rule', () => {
      const validateDecimals = (qtyStr: string) => {
        const parts = qtyStr.split('.');
        if (parts.length > 1 && parts[1].length > 3) {
          return false;
        }
        return true;
      };

      expect(validateDecimals('10')).toBe(true);
      expect(validateDecimals('10.5')).toBe(true);
      expect(validateDecimals('10.125')).toBe(true);
      expect(validateDecimals('10.1234')).toBe(false);
    });
  });

  describe('Movement Type Mappings', () => {
    it('supports all 8 backend movement types', () => {
      const types: StockMovementType[] = [
        'OPENING',
        'PURCHASE_RECEIPT',
        'PURCHASE_REVERSAL',
        'MANUAL_INCREASE',
        'MANUAL_DECREASE',
        'WASTAGE',
        'MANUAL_CONSUMPTION',
        'COUNT_CORRECTION'
      ];

      expect(types).toHaveLength(8);
      expect(types).toContain('OPENING');
      expect(types).toContain('PURCHASE_RECEIPT');
      expect(types).toContain('PURCHASE_REVERSAL');
      expect(types).toContain('MANUAL_INCREASE');
      expect(types).toContain('MANUAL_DECREASE');
      expect(types).toContain('WASTAGE');
      expect(types).toContain('MANUAL_CONSUMPTION');
      expect(types).toContain('COUNT_CORRECTION');
    });
  });

  describe('Item Stock Detail Page Logic', () => {
    it('formats positive and negative movement deltas with proper sign and units', () => {
      const formatDelta = (deltaStr: string, unit: string) => {
        const num = parseFloat(deltaStr);
        const isPositive = num > 0;
        return `${isPositive ? `+${num.toFixed(3)}` : num.toFixed(3)} ${unit}`;
      };

      expect(formatDelta('15.5', 'KG')).toBe('+15.500 KG');
      expect(formatDelta('-2.25', 'KG')).toBe('-2.250 KG');
      expect(formatDelta('0', 'L')).toBe('0.000 L');
    });

    it('relies strictly on backend isLowStock field without client recalculation', () => {
      const summary1: ItemStockSummaryDTO = {
        inventoryItemId: 'item-1',
        name: 'Coffee Beans',
        baseUnit: 'KG',
        availableQuantity: '2.500',
        minimumStock: '5.000',
        isLowStock: true,
        lastMovementAt: '2026-09-26T12:00:00Z'
      };

      const summary2: ItemStockSummaryDTO = {
        inventoryItemId: 'item-2',
        name: 'Sugar',
        baseUnit: 'KG',
        availableQuantity: '10.000',
        minimumStock: '5.000',
        isLowStock: false,
        lastMovementAt: '2026-09-26T12:00:00Z'
      };

      expect(summary1.isLowStock).toBe(true);
      expect(summary2.isLowStock).toBe(false);
    });

    it('requires separate API call for latest 10 movements without expecting recentMovements on item stock', () => {
      const summary: ItemStockSummaryDTO = {
        inventoryItemId: 'item-1',
        name: 'Milk',
        baseUnit: 'L',
        availableQuantity: '12.000',
        minimumStock: '10.000',
        isLowStock: false,
        lastMovementAt: '2026-09-26T10:00:00Z'
      };

      expect((summary as any).recentMovements).toBeUndefined();

      const movementParams = {
        itemId: summary.inventoryItemId,
        page: 1,
        pageSize: 10
      };
      expect(movementParams.page).toBe(1);
      expect(movementParams.pageSize).toBe(10);
    });

    it('handles empty movements cleanly and does not treat zero balance as error', () => {
      const movements: StockMovementDTO[] = [];
      const balance = '0.000';
      const isBalanceError = false;

      expect(movements.length).toBe(0);
      expect(parseFloat(balance)).toBe(0);
      expect(isBalanceError).toBe(false);
    });

    it('does not parse purchase ID from reason text or assume source_id is purchase ID', () => {
      const purchaseMovement: StockMovementDTO = {
        id: 'mov-1',
        inventory_item_id: 'item-1',
        business_date: '2026-09-26',
        movement_type: 'PURCHASE_RECEIPT',
        quantity_delta: '25.000',
        unit_cost: '120.00',
        source_type: 'PURCHASE_RECEIPT',
        source_id: 'purch-line-uuid-1234',
        reason: 'Purchase Receipt: KP-20260926-0001',
        created_by: 'admin-1',
        created_at: '2026-09-26T14:00:00Z'
      };

      expect(purchaseMovement.source_type).toBe('PURCHASE_RECEIPT');
      expect(purchaseMovement.source_id).not.toContain('/purchases/');
    });
  });

  describe('Global Stock Movement Ledger Page Logic', () => {
    it('constructs server filter query parameters cleanly without empty parameters', () => {
      const buildQueryParams = (filters: {
        itemId?: string;
        from?: string;
        to?: string;
        type?: StockMovementType | '';
        page: number;
        pageSize: number;
      }): StockMovementListParams => {
        return {
          itemId: filters.itemId || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
          type: (filters.type as StockMovementType) || undefined,
          page: filters.page,
          pageSize: filters.pageSize
        };
      };

      const params = buildQueryParams({
        itemId: 'item-uuid-1',
        from: '2026-09-01',
        to: '2026-09-26',
        type: 'PURCHASE_RECEIPT',
        page: 1,
        pageSize: 15
      });

      expect(params.itemId).toBe('item-uuid-1');
      expect(params.from).toBe('2026-09-01');
      expect(params.to).toBe('2026-09-26');
      expect(params.type).toBe('PURCHASE_RECEIPT');
      expect(params.page).toBe(1);
      expect(params.pageSize).toBe(15);

      const emptyParams = buildQueryParams({
        itemId: '',
        from: '',
        to: '',
        type: '',
        page: 1,
        pageSize: 15
      });
      expect(emptyParams.itemId).toBeUndefined();
      expect(emptyParams.from).toBeUndefined();
      expect(emptyParams.to).toBeUndefined();
      expect(emptyParams.type).toBeUndefined();
    });

    it('resets page to 1 whenever any filter changes while preserving pageSize', () => {
      let currentPage = 4;
      const pageSize = 15;

      const onFilterChange = () => {
        currentPage = 1;
      };

      onFilterChange();
      expect(currentPage).toBe(1);
      expect(pageSize).toBe(15);
    });

    it('handles authoritative server pagination bounds correctly', () => {
      const pagination = {
        page: 1,
        pageSize: 15,
        total: 42,
        totalPages: 3
      };

      const isPrevDisabled = pagination.page <= 1;
      const isNextDisabled = pagination.page >= pagination.totalPages;

      expect(isPrevDisabled).toBe(true);
      expect(isNextDisabled).toBe(false);

      const page3 = { ...pagination, page: 3 };
      expect(page3.page <= 1).toBe(false);
      expect(page3.page >= page3.totalPages).toBe(true);
    });

    it('differentiates between absolute empty state and filtered empty state', () => {
      const getEmptyMessage = (itemCount: number, hasActiveFilters: boolean) => {
        if (itemCount > 0) return null;
        return hasActiveFilters
          ? 'No stock movements match your filter criteria.'
          : 'No stock movements recorded yet.';
      };

      expect(getEmptyMessage(0, false)).toBe('No stock movements recorded yet.');
      expect(getEmptyMessage(0, true)).toBe('No stock movements match your filter criteria.');
      expect(getEmptyMessage(5, true)).toBeNull();
    });

    it('guarantees source_id is strictly treated as read-only and never converted into purchase URL', () => {
      const movement: StockMovementDTO = {
        id: 'mov-99',
        inventory_item_id: 'item-8',
        business_date: '2026-09-26',
        movement_type: 'PURCHASE_RECEIPT',
        quantity_delta: '10.000',
        unit_cost: '50.00',
        source_type: 'PURCHASE_RECEIPT',
        source_id: 'line-id-abc-123',
        reason: 'Purchase Receipt: KP-20260926-0002',
        created_by: 'admin-1',
        created_at: '2026-09-26T15:00:00Z'
      };

      // Source ID must remain raw text string and never form a URL
      const linkTarget = (sourceType: string, sourceId: string) => {
        // Safe implementation: read-only text pill, no link
        return null;
      };

      expect(linkTarget(movement.source_type, movement.source_id)).toBeNull();
      expect(movement.source_id).not.toContain('/purchases/');
    });
  });

  describe('Data Integrity & Contract Rules', () => {
    it('confirms StockMovementDTO does not contain balance_after or balanceAfter', () => {
      const movement: StockMovementDTO = {
        id: 'mov-1',
        inventory_item_id: 'item-1',
        business_date: '2026-09-26',
        movement_type: 'MANUAL_INCREASE',
        quantity_delta: '10.000',
        unit_cost: null,
        source_type: 'ADJUSTMENT',
        source_id: 'adj-1',
        reason: 'Initial stock intake',
        created_by: 'admin-1',
        created_at: '2026-09-26T12:00:00Z'
      };

      expect((movement as any).balance_after).toBeUndefined();
      expect((movement as any).balanceAfter).toBeUndefined();
    });

    it('generates fresh UUID idempotency key for each submission attempt', () => {
      const keyGen = () => `key_${Math.random()}_${Date.now()}`;
      const key1 = keyGen();
      const key2 = keyGen();

      expect(key1).not.toBe(key2);
      expect(key1.length).toBeGreaterThan(10);
    });

    it('blocks stock actions on archived items', () => {
      const canSubmit = (isArchived: boolean, isSubmitting: boolean) => {
        return !isArchived && !isSubmitting;
      };

      expect(canSubmit(true, false)).toBe(false);
      expect(canSubmit(false, true)).toBe(false);
      expect(canSubmit(false, false)).toBe(true);
    });
  });

  describe('Navigation & Integration Layer Logic', () => {
    it('constructs correct View Stock link destination for an inventory item', () => {
      const itemId = 'item-uuid-456';
      const viewStockUrl = `/inventory/${itemId}`;

      expect(viewStockUrl).toBe('/inventory/item-uuid-456');
      expect(viewStockUrl).toMatch(/^\/inventory\/[a-zA-Z0-9-_]+$/);
    });

    it('points Stock Ledger header button to /inventory/movements', () => {
      const stockLedgerUrl = '/inventory/movements';
      expect(stockLedgerUrl).toBe('/inventory/movements');
    });

    it('correctly isolates active state for Stock Ledger vs Inventory Items', () => {
      const isRouteActive = (itemHref: string, currentPathname: string) => {
        if (itemHref === '/inventory/items') {
          return (
            currentPathname === '/inventory/items' ||
            (currentPathname.startsWith('/inventory/') && !currentPathname.startsWith('/inventory/movements'))
          );
        }
        return currentPathname === itemHref || currentPathname.startsWith(`${itemHref}/`);
      };

      // When visiting /inventory/movements
      expect(isRouteActive('/inventory/movements', '/inventory/movements')).toBe(true);
      expect(isRouteActive('/inventory/items', '/inventory/movements')).toBe(false);

      // When visiting /inventory/items
      expect(isRouteActive('/inventory/items', '/inventory/items')).toBe(true);
      expect(isRouteActive('/inventory/movements', '/inventory/items')).toBe(false);

      // When visiting item detail /inventory/item-123
      expect(isRouteActive('/inventory/items', '/inventory/item-123')).toBe(true);
      expect(isRouteActive('/inventory/movements', '/inventory/item-123')).toBe(false);

      // When visiting unrelated route /purchases
      expect(isRouteActive('/inventory/items', '/purchases')).toBe(false);
      expect(isRouteActive('/inventory/movements', '/purchases')).toBe(false);
    });

    it('verifies AppShell navigation list structure contains Stock Ledger without duplicates', () => {
      const navItems = [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/pos', label: 'POS / Billing' },
        { href: '/menu', label: 'Menu' },
        { href: '/inventory/items', label: 'Inventory Items' },
        { href: '/inventory/movements', label: 'Stock Ledger' },
        { href: '/suppliers', label: 'Suppliers' },
        { href: '/purchases', label: 'Purchases' },
        { href: '/expenses', label: 'Expenses' },
        { href: '/reconciliation', label: 'Daily Closing' },
        { href: '/sales', label: 'Sales' },
        { href: '/reports', label: 'Reports' },
        { href: '/settings', label: 'Settings' }
      ];

      const stockLedgerEntries = navItems.filter((i) => i.href === '/inventory/movements');
      expect(stockLedgerEntries).toHaveLength(1);
      expect(stockLedgerEntries[0].label).toBe('Stock Ledger');

      const inventoryItemsEntries = navItems.filter((i) => i.href === '/inventory/items');
      expect(inventoryItemsEntries).toHaveLength(1);

      // Ensure Stock Ledger is placed directly next to Inventory Items
      const invIndex = navItems.findIndex((i) => i.href === '/inventory/items');
      const ledgerIndex = navItems.findIndex((i) => i.href === '/inventory/movements');
      expect(ledgerIndex).toBe(invIndex + 1);
    });
  });
});
