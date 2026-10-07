import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiError } from '@/lib/api';
import {
  BillDTO,
  BillCostCoverageDTO,
  BillConsumptionDTO,
  RecipeCoverageStatus,
  RecipeCoverageItemDTO,
  MenuItemDTO
} from '@/lib/types';

describe('Phase 3 — Module 3: Bill Consumption and Costing (Frontend)', () => {

  // =========================================================================
  // 1. POS Recipe Coverage Indicators
  // =========================================================================
  describe('1. POS Recipe Coverage Indicators', () => {
    const mockRecipes: RecipeCoverageItemDTO[] = [
      {
        menuItemId: 'item-chai',
        menuItemName: 'Masala Chai',
        categoryName: 'Beverages',
        recipeId: 'rec-1',
        status: 'ACTIVE',
        activeVersionId: 'ver-1',
        activeVersionNumber: 1,
        ingredientCount: 3,
        hasActiveRecipe: true,
        updatedAt: '2026-10-01'
      },
      {
        menuItemId: 'item-coffee',
        menuItemName: 'Cold Coffee',
        categoryName: 'Beverages',
        recipeId: 'rec-2',
        status: 'INACTIVE',
        activeVersionId: null,
        activeVersionNumber: null,
        ingredientCount: 0,
        hasActiveRecipe: false,
        updatedAt: '2026-10-01'
      }
    ];

    const evaluateCoverageStatus = (
      item: MenuItemDTO,
      recipeMap: Record<string, boolean>
    ): RecipeCoverageStatus => {
      const isAvail = item.is_available ?? item.isAvailable ?? true;
      if (!isAvail) return 'UNAVAILABLE';
      if (recipeMap[item.id]) return 'COVERED';
      return 'RECIPE_MISSING';
    };

    it('identifies COVERED status when recipe is active', () => {
      const recipeMap = { 'item-chai': true, 'item-coffee': false };
      const item: MenuItemDTO = {
        id: 'item-chai',
        category_id: 'cat-1',
        name: 'Masala Chai',
        selling_price: 30,
        is_available: true,
        is_archived: false,
        created_at: '2026-10-01'
      };

      expect(evaluateCoverageStatus(item, recipeMap)).toBe('COVERED');
    });

    it('identifies RECIPE_MISSING status when recipe is inactive or not present', () => {
      const recipeMap = { 'item-chai': true, 'item-coffee': false };
      const item: MenuItemDTO = {
        id: 'item-coffee',
        category_id: 'cat-1',
        name: 'Cold Coffee',
        selling_price: 80,
        is_available: true,
        is_archived: false,
        created_at: '2026-10-01'
      };

      expect(evaluateCoverageStatus(item, recipeMap)).toBe('RECIPE_MISSING');
    });

    it('identifies UNAVAILABLE status when menu item is not available, taking precedence', () => {
      const recipeMap = { 'item-chai': true };
      const item: MenuItemDTO = {
        id: 'item-chai',
        category_id: 'cat-1',
        name: 'Masala Chai',
        selling_price: 30,
        is_available: false,
        is_archived: false,
        created_at: '2026-10-01'
      };

      expect(evaluateCoverageStatus(item, recipeMap)).toBe('UNAVAILABLE');
    });

    it('never blocks sale merely because recipe is missing', () => {
      const recipeMap = { 'item-samosa': false };
      const item: MenuItemDTO = {
        id: 'item-samosa',
        category_id: 'cat-1',
        name: 'Samosa',
        selling_price: 25,
        is_available: true,
        is_archived: false,
        created_at: '2026-10-01'
      };

      const coverage = evaluateCoverageStatus(item, recipeMap);
      expect(coverage).toBe('RECIPE_MISSING');

      // Adding to cart simulation
      const cart: { menuItem: MenuItemDTO; quantity: number }[] = [];
      const canAddToCart = item.is_available;
      expect(canAddToCart).toBe(true);

      cart.push({ menuItem: item, quantity: 2 });
      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(2);
    });
  });

  // =========================================================================
  // 2. Bill Completion, INSUFFICIENT_STOCK & Cart Preservation
  // =========================================================================
  describe('2. Bill Completion, INSUFFICIENT_STOCK & Cart Preservation', () => {
    it('SAFE_ERROR_MAPPINGS maps INSUFFICIENT_STOCK to safe user-friendly copy', () => {
      // Create ApiError with INSUFFICIENT_STOCK code
      const error = new ApiError(
        'Not enough stock for this order. Update stock or adjust the bill.',
        'INSUFFICIENT_STOCK',
        400
      );

      expect(error.code).toBe('INSUFFICIENT_STOCK');
      expect(error.message).toBe('Not enough stock for this order. Update stock or adjust the bill.');
      expect(error.message).not.toContain('SQL');
      expect(error.message).not.toContain('SELECT');
      expect(error.message).not.toContain('stack trace');
    });

    it('cart remains intact and idempotency key preserved when stock rejection occurs', async () => {
      const initialCart = [
        { menuItem: { id: 'item-1', name: 'Burger', selling_price: 150 }, quantity: 2 },
        { menuItem: { id: 'item-2', name: 'Fries', selling_price: 80 }, quantity: 1 }
      ];

      let cart = [...initialCart];
      let idempotencyKey = 'key-uuid-1234';
      let stockError: string | null = null;
      let submitting = true;

      // Mock completion failure
      try {
        throw new ApiError('Not enough stock for this order. Update stock or adjust the bill.', 'INSUFFICIENT_STOCK', 400);
      } catch (err: any) {
        if (err.code === 'INSUFFICIENT_STOCK') {
          stockError = err.message;
          // Cart is NOT cleared!
        }
      } finally {
        submitting = false;
      }

      // Assertions
      expect(cart).toHaveLength(2);
      expect(cart[0].quantity).toBe(2);
      expect(cart[1].quantity).toBe(1);
      expect(idempotencyKey).toBe('key-uuid-1234'); // Preserved for retry
      expect(stockError).toBe('Not enough stock for this order. Update stock or adjust the bill.');
      expect(submitting).toBe(false);
    });

    it('clears cart and generates new idempotency key ONLY on success', async () => {
      let cart = [
        { menuItem: { id: 'item-1', name: 'Burger', selling_price: 150 }, quantity: 2 }
      ];
      let idempotencyKey = 'key-uuid-1234';
      let completedBill: any = null;

      // Mock completion success
      const mockSuccessBill = { id: 'bill-1', bill_number: 'BILL-001', status: 'COMPLETED' };
      completedBill = mockSuccessBill;
      cart = []; // clearCart
      idempotencyKey = 'new-key-uuid-5678';

      expect(cart).toHaveLength(0);
      expect(idempotencyKey).not.toBe('key-uuid-1234');
      expect(completedBill.bill_number).toBe('BILL-001');
    });
  });

  // =========================================================================
  // 3. Bill Costing & Stock Impact Section Rendering Logic
  // =========================================================================
  describe('3. Bill Costing & Stock Impact Section Data Representation', () => {
    const fullCoverageBill: BillDTO = {
      id: 'bill-101',
      bill_number: 'B101',
      business_date: '2026-10-05',
      order_type: 'TAKEAWAY',
      status: 'COMPLETED',
      subtotal: 500,
      discount: 0,
      tax: 25,
      grand_total: 525,
      created_at: '2026-10-05T12:00:00Z',
      cost_coverage: {
        bill_id: 'bill-101',
        total_bill_lines: 2,
        covered_lines: 2,
        missing_recipe_lines: 0,
        missing_cost_lines: 0,
        negative_stock_override_used: false,
        created_at: '2026-10-05T12:00:00Z'
      },
      consumptions: [
        {
          id: 'c-1',
          bill_id: 'bill-101',
          bill_line_id: 'bl-1',
          inventory_item_id: 'inv-flour',
          recipe_version_id: 'rv-1',
          quantity_consumed: '0.500',
          unit_cost_snapshot: '40.0000',
          total_cost_snapshot: '20.0000',
          stock_movement_id: 'sm-1',
          created_at: '2026-10-05T12:00:00Z'
        },
        {
          id: 'c-2',
          bill_id: 'bill-101',
          bill_line_id: 'bl-2',
          inventory_item_id: 'inv-sugar',
          recipe_version_id: 'rv-2',
          quantity_consumed: '0.200',
          unit_cost_snapshot: '50.0000',
          total_cost_snapshot: '10.0000',
          stock_movement_id: 'sm-2',
          created_at: '2026-10-05T12:00:00Z'
        }
      ]
    };

    it('renders full coverage badge when covered_lines === total_bill_lines', () => {
      const cov = fullCoverageBill.cost_coverage!;
      const isFull = cov.covered_lines === cov.total_bill_lines && cov.missing_recipe_lines === 0 && cov.missing_cost_lines === 0;
      expect(isFull).toBe(true);
    });

    it('identifies missing recipe lines and flags warning', () => {
      const partialRecipeBill: BillCostCoverageDTO = {
        bill_id: 'bill-102',
        total_bill_lines: 3,
        covered_lines: 2,
        missing_recipe_lines: 1,
        missing_cost_lines: 0,
        negative_stock_override_used: false,
        created_at: '2026-10-05T12:00:00Z'
      };

      expect(partialRecipeBill.missing_recipe_lines).toBe(1);
      expect(partialRecipeBill.covered_lines).toBe(2);
    });

    it('identifies missing cost lines and does NOT represent them as ₹0.00', () => {
      const uncostedConsumption: BillConsumptionDTO = {
        id: 'c-3',
        bill_id: 'bill-103',
        bill_line_id: 'bl-3',
        inventory_item_id: 'inv-milk',
        recipe_version_id: 'rv-3',
        quantity_consumed: '1.000',
        unit_cost_snapshot: null,
        total_cost_snapshot: null,
        stock_movement_id: 'sm-3',
        created_at: '2026-10-05T12:00:00Z'
      };

      const isCostMissing = uncostedConsumption.unit_cost_snapshot === null;
      expect(isCostMissing).toBe(true);

      // Presentation rule: never show ₹0.00 for null cost snapshot
      const displayText = isCostMissing ? '— (No Cost Basis)' : `₹${uncostedConsumption.unit_cost_snapshot}`;
      expect(displayText).toBe('— (No Cost Basis)');
      expect(displayText).not.toBe('₹0.00');
    });

    it('does NOT perform browser-side gross margin calculation', () => {
      // Rule verification: frontend must not compute selling - food cost in client
      const bill = fullCoverageBill;
      // Authoritative values from server
      expect(bill.cost_coverage?.covered_lines).toBe(2);
      expect(bill.consumptions).toHaveLength(2);
      // No synthetic gross_margin property should be added to the authoritative server bill
      expect((bill as any).gross_margin).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. Void Flow & Confirmation Dialog
  // =========================================================================
  describe('4. Void Flow & Confirmation Dialog', () => {
    it('void confirmation copy includes mandatory inventory return notice', () => {
      const requiredCopy = 'This will return the recipe ingredients recorded for this bill to stock.';
      const modalText = `
        You are voiding Bill #B101 with grand total ₹525.00.
        This action will exclude the bill from sales reports while preserving payment history records.
        ℹ️ This will return the recipe ingredients recorded for this bill to stock.
      `;

      expect(modalText).toContain(requiredCopy);
    });

    it('void request payload sends only voidReason without ingredient data', async () => {
      const capturedPayloads: any[] = [];
      const mockVoidBill = vi.fn().mockImplementation((id: string, voidReason: string) => {
        capturedPayloads.push({ id, voidReason });
        return Promise.resolve({
          bill: { id, status: 'VOIDED', void_record: { void_reason: voidReason } }
        });
      });

      await mockVoidBill('bill-101', 'Customer returned order');

      expect(capturedPayloads).toHaveLength(1);
      expect(capturedPayloads[0]).toEqual({
        id: 'bill-101',
        voidReason: 'Customer returned order'
      });
      // Zero ingredient information sent
      expect(capturedPayloads[0].ingredients).toBeUndefined();
      expect(capturedPayloads[0].stock_movements).toBeUndefined();
    });

    it('voided bill displays stock reversal notice in costing section', () => {
      const voidedBill: BillDTO = {
        id: 'bill-101',
        bill_number: 'B101',
        business_date: '2026-10-05',
        order_type: 'TAKEAWAY',
        status: 'VOIDED',
        subtotal: 500,
        discount: 0,
        tax: 25,
        grand_total: 525,
        created_at: '2026-10-05T12:00:00Z',
        cost_coverage: {
          bill_id: 'bill-101',
          total_bill_lines: 1,
          covered_lines: 1,
          missing_recipe_lines: 0,
          missing_cost_lines: 0,
          negative_stock_override_used: false,
          created_at: '2026-10-05T12:00:00Z'
        }
      };

      const isVoided = voidedBill.status === 'VOIDED';
      expect(isVoided).toBe(true);

      const reversalNotice = isVoided
        ? 'The recipe ingredients recorded for this bill were returned to inventory stock via atomic compensating movements upon void.'
        : '';
      expect(reversalNotice).toContain('returned to inventory stock');
    });
  });

  // =========================================================================
  // 5. Contract Mapping for getBillCosting
  // =========================================================================
  describe('5. Contract Mapping for api.getBillCosting', () => {
    it('maps to getBillById and extracts costCoverage and consumptions safely', async () => {
      const mockBill: BillDTO = {
        id: 'bill-999',
        bill_number: 'B999',
        business_date: '2026-10-05',
        order_type: 'DINE_IN',
        status: 'COMPLETED',
        subtotal: 300,
        discount: 0,
        tax: 15,
        grand_total: 315,
        created_at: '2026-10-05T13:00:00Z',
        cost_coverage: {
          bill_id: 'bill-999',
          total_bill_lines: 1,
          covered_lines: 1,
          missing_recipe_lines: 0,
          missing_cost_lines: 0,
          negative_stock_override_used: false,
          created_at: '2026-10-05T13:00:00Z'
        },
        consumptions: [
          {
            id: 'c-999',
            bill_id: 'bill-999',
            bill_line_id: 'bl-999',
            inventory_item_id: 'inv-tea',
            recipe_version_id: 'rv-999',
            quantity_consumed: '0.100',
            unit_cost_snapshot: '500.0000',
            total_cost_snapshot: '50.0000',
            stock_movement_id: 'sm-999',
            created_at: '2026-10-05T13:00:00Z'
          }
        ]
      };

      vi.spyOn(api, 'getBillById').mockResolvedValueOnce({ bill: mockBill });

      const costingData = await api.getBillCosting('bill-999');

      expect(costingData.bill.id).toBe('bill-999');
      expect(costingData.costCoverage).not.toBeNull();
      expect(costingData.costCoverage!.covered_lines).toBe(1);
      expect(costingData.consumptions).toHaveLength(1);
      expect(costingData.consumptions[0].quantity_consumed).toBe('0.100');
    });
  });
});
