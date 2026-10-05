import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, withTransaction } from '@/shared/database/client';
import { BillingService } from '@/modules/billing/billing.service';
import { BillingRepository } from '@/modules/billing/billing.repository';
import { CostingRepository } from '@/modules/billing/costing.repository';
import { CostingService } from '@/modules/billing/costing.service';
import { PurchaseService } from '@/modules/purchases/purchases.service';
import { SupplierRepository } from '@/modules/supplier/supplier.repository';
import { InventoryRepository } from '@/modules/inventory/inventory.repository';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { RecipeRepository } from '@/modules/recipe/recipe.repository';
import { InsufficientStockError, ValidationError, ConflictError } from '@/shared/errors';
import Decimal from 'decimal.js';

describe('Phase 3 Module 3: Bill Consumption and Costing Integration Tests', { timeout: 90000 }, () => {
  let adminId: string;
  let testSupplierId: string;

  beforeAll(async () => {
    // 1. Get or create test admin
    const { rows: adminRows } = await query("SELECT id FROM admins WHERE email = 'costing_admin@koyal.com'");
    if (adminRows.length > 0) {
      adminId = adminRows[0].id;
    } else {
      const { rows: newAdmin } = await query(`
        INSERT INTO admins (email, password_hash, display_name, is_active)
        VALUES ('costing_admin@koyal.com', 'dummyhash', 'Costing Admin', true)
        RETURNING id;
      `);
      adminId = newAdmin[0].id;
    }

    // 2. Create supplier for purchases
    const supplier = await SupplierRepository.create(
      {
        name: `Costing Test Supplier ${Date.now()}`,
        contactPerson: 'Suresh'
      },
      adminId
    );
    testSupplierId = supplier.id;
  });

  // Helper to create an active menu item
  async function createMenuItem(name: string, price: number = 100) {
    const { rows: catRows } = await query(`
      INSERT INTO menu_categories (name, display_order)
      VALUES ($1, 999)
      RETURNING id;
    `, [`Cat_${Date.now()}_${Math.random()}`]);
    const categoryId = catRows[0].id;

    const { rows: menuRows } = await query(`
      INSERT INTO menu_items (category_id, name, selling_price, is_available, is_archived)
      VALUES ($1, $2, $3, TRUE, FALSE)
      RETURNING id, name, selling_price;
    `, [categoryId, `${name}_${Date.now()}_${Math.random()}`, price]);
    return menuRows[0];
  }

  // Helper to create an inventory item
  async function createItem(name: string) {
    return InventoryRepository.create(
      {
        name: `${name}_${Date.now()}_${Math.random()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: 1.0
      },
      adminId
    );
  }

  // Helper to create and activate a recipe
  async function createActiveRecipe(menuItemId: string, ingredients: Array<{ inventoryItemId: string; quantity: number | string; wastagePct?: number }>) {
    const recipe = await RecipeRepository.createRecipe({ menuItemId, createdBy: adminId });
    const version = await RecipeRepository.createVersion({
      recipeId: recipe.id,
      versionNumber: 1,
      status: 'ACTIVE',
      createdBy: adminId
    });

    const ingInputs = ingredients.map((ing) => ({
      inventoryItemId: ing.inventoryItemId,
      itemNameSnapshot: 'Ingredient Snapshot',
      unitSnapshot: 'KG',
      quantity: ing.quantity,
      wastageAllowancePct: ing.wastagePct || 0
    }));

    await RecipeRepository.insertIngredients(version.id, ingInputs);
    await RecipeRepository.updateRecipeActiveVersion({
      recipeId: recipe.id,
      activeVersionId: version.id,
      status: 'ACTIVE'
    });

    return { recipe, version };
  }

  // Helper to receive a purchase and establish physical stock + cost basis
  async function receivePurchaseStock(itemId: string, quantity: number, unitRate: number) {
    const draft = await PurchaseService.createDraft(
      {
        supplierId: testSupplierId,
        purchaseDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'CASH',
        lines: [{ inventoryItemId: itemId, quantity, unitRate }]
      },
      adminId
    );
    await PurchaseService.receivePurchase(draft.id, adminId, `idem-purchase-${Date.now()}-${Math.random()}`);
  }

  // =========================================================================
  // T1: Full Coverage Bill
  // =========================================================================
  it('T1: Full Coverage Bill - consumes physical stock, creates snapshots, decrements cost basis, covered_lines=1', async () => {
    const itemA = await createItem('T1_ItemA');
    const itemB = await createItem('T1_ItemB');

    // 10 KG @ 100 for A, 10 KG @ 50 for B
    await receivePurchaseStock(itemA.id, 10, 100);
    await receivePurchaseStock(itemB.id, 10, 50);

    const menuItem = await createMenuItem('T1_Dish', 200);
    // Recipe: 0.5 KG A, 0.2 KG B per dish
    await createActiveRecipe(menuItem.id, [
      { inventoryItemId: itemA.id, quantity: 0.5 },
      { inventoryItemId: itemB.id, quantity: 0.2 }
    ]);

    // Bill for quantity 2 -> requires 1.0 KG of A, 0.4 KG of B
    const bill = await BillingService.completeBill(
      {
        orderType: 'TAKEAWAY',
        items: [{ menuItemId: menuItem.id, quantity: 2 }],
        paymentMethod: 'CASH'
      },
      adminId
    );

    expect(bill.status).toBe('COMPLETED');

    // Check coverage
    const coverage = await CostingRepository.findCoverageByBillId(bill.id);
    expect(coverage).not.toBeNull();
    expect(coverage!.total_bill_lines).toBe(1);
    expect(coverage!.covered_lines).toBe(1);
    expect(coverage!.missing_recipe_lines).toBe(0);
    expect(coverage!.missing_cost_lines).toBe(0);
    expect(coverage!.negative_stock_override_used).toBe(false);

    // Check physical balance: A had 10 -> now 9, B had 10 -> now 9.6
    const stockA = await StockLedgerService.getItemStock(itemA.id);
    const stockB = await StockLedgerService.getItemStock(itemB.id);
    expect(Number(stockA.availableQuantity)).toBeCloseTo(9.0, 3);
    expect(Number(stockB.availableQuantity)).toBeCloseTo(9.6, 3);

    // Check cost state: A basis was 10 -> now 9, B basis was 10 -> now 9.6
    const costA = await CostingRepository.getCostState(itemA.id);
    const costB = await CostingRepository.getCostState(itemB.id);
    expect(Number(costA!.quantity_on_cost_basis)).toBeCloseTo(9.0, 3);
    expect(Number(costB!.quantity_on_cost_basis)).toBeCloseTo(9.6, 3);
    expect(Number(costA!.average_unit_cost)).toBeCloseTo(100.0, 4);
    expect(Number(costB!.average_unit_cost)).toBeCloseTo(50.0, 4);

    // Check bill_consumptions
    const consumptions = await CostingRepository.findConsumptionsByBillId(bill.id);
    expect(consumptions.length).toBe(2);

    const consA = consumptions.find((c) => c.inventory_item_id === itemA.id);
    const consB = consumptions.find((c) => c.inventory_item_id === itemB.id);
    expect(consA).toBeDefined();
    expect(consB).toBeDefined();

    expect(Number(consA!.quantity_consumed)).toBeCloseTo(1.0, 3);
    expect(consA!.unit_cost_snapshot).toBe('100.0000');
    expect(consA!.total_cost_snapshot).toBe('100.0000');

    expect(Number(consB!.quantity_consumed)).toBeCloseTo(0.4, 3);
    expect(consB!.unit_cost_snapshot).toBe('50.0000');
    expect(consB!.total_cost_snapshot).toBe('20.0000');
  });

  // =========================================================================
  // T2: Missing Recipe
  // =========================================================================
  it('T2: Missing Recipe - completes bill without stock movement, missing_recipe_lines=1', async () => {
    const menuItemNoRecipe = await createMenuItem('T2_Dish_NoRecipe', 150);

    const bill = await BillingService.completeBill(
      {
        orderType: 'TAKEAWAY',
        items: [{ menuItemId: menuItemNoRecipe.id, quantity: 3 }],
        paymentMethod: 'CASH'
      },
      adminId
    );

    expect(bill.status).toBe('COMPLETED');

    const coverage = await CostingRepository.findCoverageByBillId(bill.id);
    expect(coverage).not.toBeNull();
    expect(coverage!.total_bill_lines).toBe(1);
    expect(coverage!.covered_lines).toBe(0);
    expect(coverage!.missing_recipe_lines).toBe(1);
    expect(coverage!.missing_cost_lines).toBe(0);

    // Zero consumptions recorded
    const consumptions = await CostingRepository.findConsumptionsByBillId(bill.id);
    expect(consumptions.length).toBe(0);
  });

  // =========================================================================
  // T3: Insufficient Cost Basis
  // =========================================================================
  it('T3: Insufficient Cost Basis (basis 2 KG, required 5 KG) - physical stock decrements, snapshots NULL, basis untouched, missing_cost_lines=1', async () => {
    const item = await createItem('T3_Item');
    // Receive 2 KG @ 100 -> physical=2, basis=2
    await receivePurchaseStock(item.id, 2, 100);

    // Add 8 KG via manual opening/increase without cost -> physical=10, basis=2
    await StockLedgerService.recordAdjustment(
      {
        inventoryItemId: item.id,
        type: 'MANUAL_INCREASE',
        quantity: 8,
        reason: 'Physical count found extra'
      },
      adminId
    );

    const preStock = await StockLedgerService.getItemStock(item.id);
    expect(Number(preStock.availableQuantity)).toBeCloseTo(10.0, 3);
    const preCost = await CostingRepository.getCostState(item.id);
    expect(Number(preCost!.quantity_on_cost_basis)).toBeCloseTo(2.0, 3);

    const menuItem = await createMenuItem('T3_Dish', 300);
    // Recipe: 1.0 KG per dish
    await createActiveRecipe(menuItem.id, [{ inventoryItemId: item.id, quantity: 1.0 }]);

    // Order 5 dishes -> required = 5 KG (available physical=10, but basis=2 < 5)
    const bill = await BillingService.completeBill(
      {
        orderType: 'TAKEAWAY',
        items: [{ menuItemId: menuItem.id, quantity: 5 }],
        paymentMethod: 'CASH'
      },
      adminId
    );

    const coverage = await CostingRepository.findCoverageByBillId(bill.id);
    expect(coverage!.covered_lines).toBe(0);
    expect(coverage!.missing_cost_lines).toBe(1);

    // Physical stock decrements by 5 -> remaining 5.0
    const postStock = await StockLedgerService.getItemStock(item.id);
    expect(Number(postStock.availableQuantity)).toBeCloseTo(5.0, 3);

    // Cost basis remains UNTOUCHED at 2.0 (does not absorb partial or go negative!)
    const postCost = await CostingRepository.getCostState(item.id);
    expect(Number(postCost!.quantity_on_cost_basis)).toBeCloseTo(2.0, 3);

    // Consumptions snapshots are NULL
    const consumptions = await CostingRepository.findConsumptionsByBillId(bill.id);
    expect(consumptions.length).toBe(1);
    expect(consumptions[0].unit_cost_snapshot).toBeNull();
    expect(consumptions[0].total_cost_snapshot).toBeNull();
    expect(Number(consumptions[0].quantity_consumed)).toBeCloseTo(5.0, 3);
  });

  // =========================================================================
  // T4: Zero Cost Basis
  // =========================================================================
  it('T4: Zero Cost Basis - physical stock decrements, snapshots NULL, basis remains 0, missing_cost_lines=1', async () => {
    const item = await createItem('T4_Item');
    // Add 10 KG purely via manual adjustment (no purchases ever)
    await StockLedgerService.recordAdjustment(
      {
        inventoryItemId: item.id,
        type: 'MANUAL_INCREASE',
        quantity: 10,
        reason: 'Opening donation'
      },
      adminId
    );

    const menuItem = await createMenuItem('T4_Dish', 100);
    await createActiveRecipe(menuItem.id, [{ inventoryItemId: item.id, quantity: 2.5 }]);

    // Order 2 dishes -> required = 5.0 KG
    const bill = await BillingService.completeBill(
      {
        orderType: 'TAKEAWAY',
        items: [{ menuItemId: menuItem.id, quantity: 2 }],
        paymentMethod: 'CASH'
      },
      adminId
    );

    const coverage = await CostingRepository.findCoverageByBillId(bill.id);
    expect(coverage!.covered_lines).toBe(0);
    expect(coverage!.missing_cost_lines).toBe(1);

    const postStock = await StockLedgerService.getItemStock(item.id);
    expect(Number(postStock.availableQuantity)).toBeCloseTo(5.0, 3);

    const postCost = await CostingRepository.getCostState(item.id);
    expect(Number(postCost!.quantity_on_cost_basis)).toBeCloseTo(0.0, 3);

    const consumptions = await CostingRepository.findConsumptionsByBillId(bill.id);
    expect(consumptions.length).toBe(1);
    expect(consumptions[0].unit_cost_snapshot).toBeNull();
    expect(consumptions[0].total_cost_snapshot).toBeNull();
  });

  // =========================================================================
  // T5: Insufficient Physical Stock
  // =========================================================================
  it('T5: Insufficient Physical Stock - throws InsufficientStockError and rolls back bill transaction', async () => {
    const item = await createItem('T5_Item');
    await receivePurchaseStock(item.id, 3, 100); // 3 KG available

    const menuItem = await createMenuItem('T5_Dish', 100);
    await createActiveRecipe(menuItem.id, [{ inventoryItemId: item.id, quantity: 1.0 }]);

    // Attempt to order 5 dishes -> needs 5 KG, only 3 available
    await expect(
      BillingService.completeBill(
        {
          orderType: 'TAKEAWAY',
          items: [{ menuItemId: menuItem.id, quantity: 5 }],
          paymentMethod: 'CASH'
        },
        adminId
      )
    ).rejects.toThrow(InsufficientStockError);

    // Verify stock remains exactly 3 KG
    const stock = await StockLedgerService.getItemStock(item.id);
    expect(Number(stock.availableQuantity)).toBeCloseTo(3.0, 3);

    // Verify no bill was created
    const { rows: billRows } = await query(`
      SELECT b.* FROM bills b
      JOIN bill_lines bl ON b.id = bl.bill_id
      WHERE bl.menu_item_id = $1
    `, [menuItem.id]);
    expect(billRows.length).toBe(0);
  });

  // =========================================================================
  // T6: Costed Void Case
  // =========================================================================
  it('T6: Costed Void Case - void restores physical quantity AND restores cost-basis quantity', async () => {
    const item = await createItem('T6_Item');
    await receivePurchaseStock(item.id, 10, 80); // 10 KG @ 80

    const menuItem = await createMenuItem('T6_Dish', 150);
    await createActiveRecipe(menuItem.id, [{ inventoryItemId: item.id, quantity: 4.0 }]);

    // Bill consumes 4 KG
    const bill = await BillingService.completeBill(
      {
        orderType: 'TAKEAWAY',
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        paymentMethod: 'CASH'
      },
      adminId
    );

    // Post-bill: physical=6, basis=6
    let stock = await StockLedgerService.getItemStock(item.id);
    expect(Number(stock.availableQuantity)).toBeCloseTo(6.0, 3);
    let cost = await CostingRepository.getCostState(item.id);
    expect(Number(cost!.quantity_on_cost_basis)).toBeCloseTo(6.0, 3);

    // Void the bill
    const voidedBill = await BillingService.voidBill(bill.id, 'Customer cancellation', adminId);
    expect(voidedBill!.status).toBe('VOIDED');

    // Post-void: physical=10, basis=10
    stock = await StockLedgerService.getItemStock(item.id);
    expect(Number(stock.availableQuantity)).toBeCloseTo(10.0, 3);
    cost = await CostingRepository.getCostState(item.id);
    expect(Number(cost!.quantity_on_cost_basis)).toBeCloseTo(10.0, 3);
    expect(Number(cost!.average_unit_cost)).toBeCloseTo(80.0, 4);

    // Verify original consumptions rows remain immutable
    const consumptions = await CostingRepository.findConsumptionsByBillId(bill.id);
    expect(consumptions.length).toBe(1);
    expect(consumptions[0].unit_cost_snapshot).toBe('80.0000');
  });

  // =========================================================================
  // T7: Uncosted Void Case
  // =========================================================================
  it('T7: Uncosted Void Case - void restores physical quantity BUT does NOT restore cost-basis quantity', async () => {
    const item = await createItem('T7_Item');
    // 10 KG purely physical, cost basis = 0
    await StockLedgerService.recordAdjustment(
      {
        inventoryItemId: item.id,
        type: 'MANUAL_INCREASE',
        quantity: 10,
        reason: 'Opening count'
      },
      adminId
    );

    const menuItem = await createMenuItem('T7_Dish', 150);
    await createActiveRecipe(menuItem.id, [{ inventoryItemId: item.id, quantity: 4.0 }]);

    // Bill consumes 4 KG uncosted
    const bill = await BillingService.completeBill(
      {
        orderType: 'TAKEAWAY',
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        paymentMethod: 'CASH'
      },
      adminId
    );

    // Post-bill: physical=6, basis=0
    let stock = await StockLedgerService.getItemStock(item.id);
    expect(Number(stock.availableQuantity)).toBeCloseTo(6.0, 3);
    let cost = await CostingRepository.getCostState(item.id);
    expect(Number(cost!.quantity_on_cost_basis)).toBeCloseTo(0.0, 3);

    // Void the bill
    await BillingService.voidBill(bill.id, 'Wrong table ordered', adminId);

    // Post-void: physical MUST return to 10.0, basis MUST REMAIN 0.0
    stock = await StockLedgerService.getItemStock(item.id);
    expect(Number(stock.availableQuantity)).toBeCloseTo(10.0, 3);

    cost = await CostingRepository.getCostState(item.id);
    expect(Number(cost!.quantity_on_cost_basis)).toBeCloseTo(0.0, 3);
  });

  // =========================================================================
  // T8: Void Idempotency Order
  // =========================================================================
  it('T8: Void Idempotency Order - cached response on retry, conflict on mismatch, ValidationError on already-voided bill', async () => {
    const item = await createItem('T8_Item');
    await receivePurchaseStock(item.id, 5, 50);

    const menuItem = await createMenuItem('T8_Dish', 100);
    await createActiveRecipe(menuItem.id, [{ inventoryItemId: item.id, quantity: 1.0 }]);

    const bill = await BillingService.completeBill(
      {
        orderType: 'TAKEAWAY',
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        paymentMethod: 'CASH'
      },
      adminId
    );

    const idempotencyKey = `idem-void-${Date.now()}`;

    // 1. Initial void with Idempotency-Key
    const firstVoid = await BillingService.voidBill(bill.id, 'Customer returned food', adminId, idempotencyKey);
    expect(firstVoid!.status).toBe('VOIDED');

    // 2. Retry with same Idempotency-Key and same reason -> returns cached result
    const secondVoid = await BillingService.voidBill(bill.id, 'Customer returned food', adminId, idempotencyKey);
    expect(secondVoid!.status).toBe('VOIDED');
    expect(secondVoid!.id).toBe(firstVoid!.id);

    // 3. Retry with same Idempotency-Key but different reason -> ConflictError
    await expect(
      BillingService.voidBill(bill.id, 'Different reason altogether', adminId, idempotencyKey)
    ).rejects.toThrow(ConflictError);

    // 4. Void again with a NEW Idempotency-Key on already-voided bill -> ValidationError
    const newKey = `idem-void-new-${Date.now()}`;
    await expect(
      BillingService.voidBill(bill.id, 'Another attempt', adminId, newKey)
    ).rejects.toThrow(ValidationError);
  });

  // =========================================================================
  // T9: Weighted Average Cost Updates
  // =========================================================================
  it('T9: Weighted Average Cost Updates - 10 @ 100 then 10 @ 120 gives avg 110.0000; consumption preserves avg', async () => {
    const item = await createItem('T9_Item');

    // Receipt 1: 10 @ 100 -> avg=100.0000, basis=10.000
    await receivePurchaseStock(item.id, 10, 100);
    let cost = await CostingRepository.getCostState(item.id);
    expect(Number(cost!.average_unit_cost)).toBeCloseTo(100.0, 4);
    expect(Number(cost!.quantity_on_cost_basis)).toBeCloseTo(10.0, 3);

    // Receipt 2: 10 @ 120 -> avg=(1000 + 1200)/20 = 110.0000, basis=20.000
    await receivePurchaseStock(item.id, 10, 120);
    cost = await CostingRepository.getCostState(item.id);
    expect(Number(cost!.average_unit_cost)).toBeCloseTo(110.0, 4);
    expect(Number(cost!.quantity_on_cost_basis)).toBeCloseTo(20.0, 3);

    // Bill consumes 5 KG
    const menuItem = await createMenuItem('T9_Dish', 250);
    await createActiveRecipe(menuItem.id, [{ inventoryItemId: item.id, quantity: 5.0 }]);

    const bill = await BillingService.completeBill(
      {
        orderType: 'TAKEAWAY',
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        paymentMethod: 'CASH'
      },
      adminId
    );

    // Post-bill: basis=15.000, avg remains 110.0000
    cost = await CostingRepository.getCostState(item.id);
    expect(Number(cost!.quantity_on_cost_basis)).toBeCloseTo(15.0, 3);
    expect(Number(cost!.average_unit_cost)).toBeCloseTo(110.0, 4);

    const consumptions = await CostingRepository.findConsumptionsByBillId(bill.id);
    expect(consumptions[0].unit_cost_snapshot).toBe('110.0000');
    expect(consumptions[0].total_cost_snapshot).toBe('550.0000');
  });

  // =========================================================================
  // T10: Multi-Ingredient Partial Cost
  // =========================================================================
  it('T10: Multi-Ingredient Partial Cost - Item A covered, Item B missing -> whole line missing_cost_lines=1, snapshots NULL', async () => {
    const itemA = await createItem('T10_ItemA');
    const itemB = await createItem('T10_ItemB');

    // Item A has stock and cost basis
    await receivePurchaseStock(itemA.id, 10, 100);

    // Item B has physical stock but NO cost basis
    await StockLedgerService.recordAdjustment(
      {
        inventoryItemId: itemB.id,
        type: 'MANUAL_INCREASE',
        quantity: 10,
        reason: 'Manual stock addition'
      },
      adminId
    );

    const menuItem = await createMenuItem('T10_Dish', 200);
    // Recipe requires both A and B
    await createActiveRecipe(menuItem.id, [
      { inventoryItemId: itemA.id, quantity: 1.0 },
      { inventoryItemId: itemB.id, quantity: 1.0 }
    ]);

    const bill = await BillingService.completeBill(
      {
        orderType: 'TAKEAWAY',
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        paymentMethod: 'CASH'
      },
      adminId
    );

    const coverage = await CostingRepository.findCoverageByBillId(bill.id);
    // Line fails full cost coverage because Item B has no cost basis
    expect(coverage!.covered_lines).toBe(0);
    expect(coverage!.missing_cost_lines).toBe(1);

    // Both consumptions must have NULL snapshots
    const consumptions = await CostingRepository.findConsumptionsByBillId(bill.id);
    expect(consumptions.length).toBe(2);
    for (const c of consumptions) {
      expect(c.unit_cost_snapshot).toBeNull();
      expect(c.total_cost_snapshot).toBeNull();
    }

    // Item A's cost basis is NOT decremented (preserved for lines that can be fully costed)
    const costA = await CostingRepository.getCostState(itemA.id);
    expect(Number(costA!.quantity_on_cost_basis)).toBeCloseTo(10.0, 3);
  });

  // =========================================================================
  // T11: Safe Initialization & Concurrency Locking
  // =========================================================================
  it('T11: Safe Initialization & Concurrency - never-purchased items initialized safely via ON CONFLICT DO NOTHING, concurrent transactions complete without deadlock (40P01)', async () => {
    const itemX = await createItem('T11_ItemX');
    const itemY = await createItem('T11_ItemY');

    // Add physical stock to both without purchasing (uninitialized inventory_cost_state)
    await StockLedgerService.recordAdjustment(
      { inventoryItemId: itemX.id, type: 'MANUAL_INCREASE', quantity: 50, reason: 'Stock init' },
      adminId
    );
    await StockLedgerService.recordAdjustment(
      { inventoryItemId: itemY.id, type: 'MANUAL_INCREASE', quantity: 50, reason: 'Stock init' },
      adminId
    );

    // Dishes that consume X then Y, or Y then X
    const dish1 = await createMenuItem('T11_Dish1', 100);
    await createActiveRecipe(dish1.id, [
      { inventoryItemId: itemX.id, quantity: 1.0 },
      { inventoryItemId: itemY.id, quantity: 1.0 }
    ]);

    const dish2 = await createMenuItem('T11_Dish2', 100);
    await createActiveRecipe(dish2.id, [
      { inventoryItemId: itemY.id, quantity: 1.0 },
      { inventoryItemId: itemX.id, quantity: 1.0 }
    ]);

    // Launch concurrent bill completions interleaved
    const billPromises = [
      BillingService.completeBill({ orderType: 'TAKEAWAY', items: [{ menuItemId: dish1.id, quantity: 2 }], paymentMethod: 'CASH' }, adminId),
      BillingService.completeBill({ orderType: 'TAKEAWAY', items: [{ menuItemId: dish2.id, quantity: 2 }], paymentMethod: 'CASH' }, adminId),
      BillingService.completeBill({ orderType: 'TAKEAWAY', items: [{ menuItemId: dish1.id, quantity: 1 }], paymentMethod: 'CASH' }, adminId),
      BillingService.completeBill({ orderType: 'TAKEAWAY', items: [{ menuItemId: dish2.id, quantity: 1 }], paymentMethod: 'CASH' }, adminId)
    ];

    const results = await Promise.all(billPromises);
    expect(results.length).toBe(4);
    for (const res of results) {
      expect(res.status).toBe('COMPLETED');
    }

    // Verify inventory_cost_state rows were safely initialized
    const costX = await CostingRepository.getCostState(itemX.id);
    const costY = await CostingRepository.getCostState(itemY.id);
    expect(costX).not.toBeNull();
    expect(costY).not.toBeNull();
  });
});
