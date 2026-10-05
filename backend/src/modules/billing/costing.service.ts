import Decimal from 'decimal.js';
import { PoolClient } from 'pg';
import { RecipeRepository } from '../recipe/recipe.repository';
import { StockRepository } from '../stock/stock.repository';
import { StockLedgerService } from '../stock/stock.service';
import { CostingRepository } from './costing.repository';
import { BillRecord, BillLineRecord } from './billing.repository';
import { InsufficientStockError } from '@/shared/errors';
import { BillCostCoverage } from './costing.types';

export class CostingService {
  static async processBillConsumption(
    bill: BillRecord,
    lines: BillLineRecord[],
    adminId: string,
    client: PoolClient
  ): Promise<BillCostCoverage> {
    const totalBillLines = lines.length;
    let coveredLines = 0;
    let missingRecipeLines = 0;
    let missingCostLines = 0;

    interface ResolvedLine {
      line: BillLineRecord;
      hasActiveRecipe: boolean;
      recipeVersionId?: string;
      ingredients: {
        inventoryItemId: string;
        requiredQty: Decimal;
      }[];
    }

    const resolvedLines: ResolvedLine[] = [];
    const allItemIds = new Set<string>();

    // 1. Resolve active recipe for each bill line
    for (const line of lines) {
      if (!line.menu_item_id) {
        resolvedLines.push({ line, hasActiveRecipe: false, ingredients: [] });
        continue;
      }

      const recipe = await RecipeRepository.findRecipeByMenuItemId(line.menu_item_id, client);
      if (!recipe || recipe.status !== 'ACTIVE' || !recipe.active_version_id) {
        resolvedLines.push({ line, hasActiveRecipe: false, ingredients: [] });
        continue;
      }

      const rawIngredients = await RecipeRepository.listIngredientsByVersionId(recipe.active_version_id, client);
      if (rawIngredients.length === 0) {
        resolvedLines.push({ line, hasActiveRecipe: false, ingredients: [] });
        continue;
      }

      const lineIngredients = rawIngredients.map((ing) => {
        allItemIds.add(ing.inventory_item_id);
        const billQty = new Decimal(line.quantity);
        const ingQty = new Decimal(ing.quantity);
        const wastage = new Decimal(ing.wastage_allowance_pct || 0);
        const requiredQty = billQty
          .times(ingQty)
          .times(new Decimal(1).plus(wastage.dividedBy(100)))
          .toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

        return {
          inventoryItemId: ing.inventory_item_id,
          requiredQty
        };
      });

      resolvedLines.push({
        line,
        hasActiveRecipe: true,
        recipeVersionId: recipe.active_version_id,
        ingredients: lineIngredients
      });
    }

    // If no recipe ingredients exist across the entire bill
    if (allItemIds.size === 0) {
      for (const rl of resolvedLines) {
        if (!rl.hasActiveRecipe) {
          missingRecipeLines++;
        }
      }
      return CostingRepository.insertBillCostCoverage(
        {
          billId: bill.id,
          totalBillLines,
          coveredLines: 0,
          missingRecipeLines,
          missingCostLines: 0,
          negativeStockOverrideUsed: false
        },
        client
      );
    }

    // 2. Deterministic ascending row lock on all affected inventory items
    const sortedItemIds = Array.from(allItemIds).sort((a, b) => a.localeCompare(b));
    const physicalBalances: Record<string, Decimal> = {};
    const costStates: Record<string, { avgCost: Decimal; basisQty: Decimal }> = {};

    for (const itemId of sortedItemIds) {
      const balance = await StockRepository.lockAndGetBalance(itemId, client);
      const costState = await CostingRepository.lockAndGetCostState(itemId, client);
      physicalBalances[itemId] = balance;
      costStates[itemId] = {
        avgCost: new Decimal(costState.average_unit_cost),
        basisQty: new Decimal(costState.quantity_on_cost_basis)
      };
    }

    // 3. Verify physical stock sufficiency across all lines before deducting anything
    const totalPhysicalNeeded: Record<string, Decimal> = {};
    for (const rl of resolvedLines) {
      if (!rl.hasActiveRecipe) continue;
      for (const ing of rl.ingredients) {
        totalPhysicalNeeded[ing.inventoryItemId] = (totalPhysicalNeeded[ing.inventoryItemId] || new Decimal(0)).plus(
          ing.requiredQty
        );
      }
    }

    for (const itemId of sortedItemIds) {
      const needed = totalPhysicalNeeded[itemId] || new Decimal(0);
      if (physicalBalances[itemId].lt(needed)) {
        throw new InsufficientStockError(
          `Insufficient stock for inventory item ${itemId}. Required: ${needed.toFixed(3)}, Available: ${physicalBalances[itemId].toFixed(3)}.`
        );
      }
    }

    // 4. Process line-by-line consumption and costing
    for (const rl of resolvedLines) {
      if (!rl.hasActiveRecipe) {
        missingRecipeLines++;
        // Missing active recipe: NO consumption rows, NO stock movement
        continue;
      }

      // Check if ALL ingredients have sufficient cost basis
      let allIngredientsCovered = true;
      for (const ing of rl.ingredients) {
        const currentBasis = costStates[ing.inventoryItemId].basisQty;
        if (currentBasis.lt(ing.requiredQty)) {
          allIngredientsCovered = false;
          break;
        }
      }

      if (allIngredientsCovered) {
        coveredLines++;
        for (const ing of rl.ingredients) {
          const state = costStates[ing.inventoryItemId];
          const unitCostSnapshot = state.avgCost.toFixed(4);
          const totalCostSnapshot = ing.requiredQty
            .times(state.avgCost)
            .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
            .toFixed(4);

          // Deduct cost basis
          state.basisQty = state.basisQty.minus(ing.requiredQty);
          await CostingRepository.updateCostState(ing.inventoryItemId, state.avgCost, state.basisQty, client);

          // Record stock movement (BILL_CONSUMPTION)
          const movement = await StockLedgerService.recordBillConsumption(
            {
              inventoryItemId: ing.inventoryItemId,
              businessDate: bill.business_date,
              quantityDelta: ing.requiredQty.negated(),
              unitCost: unitCostSnapshot,
              sourceId: bill.id,
              reason: `Bill consumption: ${bill.bill_number}`,
              createdBy: adminId
            },
            client
          );

          // Insert bill_consumptions row
          await CostingRepository.insertBillConsumption(
            {
              billId: bill.id,
              billLineId: rl.line.id,
              inventoryItemId: ing.inventoryItemId,
              recipeVersionId: rl.recipeVersionId!,
              quantityConsumed: ing.requiredQty.toFixed(3),
              unitCostSnapshot,
              totalCostSnapshot,
              stockMovementId: movement.id
            },
            client
          );
        }
      } else {
        missingCostLines++;
        for (const ing of rl.ingredients) {
          // Uncosted line: physical stock is decremented, but snapshots are NULL and cost basis is NOT deducted
          const movement = await StockLedgerService.recordBillConsumption(
            {
              inventoryItemId: ing.inventoryItemId,
              businessDate: bill.business_date,
              quantityDelta: ing.requiredQty.negated(),
              unitCost: null,
              sourceId: bill.id,
              reason: `Bill consumption (uncosted): ${bill.bill_number}`,
              createdBy: adminId
            },
            client
          );

          await CostingRepository.insertBillConsumption(
            {
              billId: bill.id,
              billLineId: rl.line.id,
              inventoryItemId: ing.inventoryItemId,
              recipeVersionId: rl.recipeVersionId!,
              quantityConsumed: ing.requiredQty.toFixed(3),
              unitCostSnapshot: null,
              totalCostSnapshot: null,
              stockMovementId: movement.id
            },
            client
          );
        }
      }
    }

    // 5. Insert bill_cost_coverage record
    return CostingRepository.insertBillCostCoverage(
      {
        billId: bill.id,
        totalBillLines,
        coveredLines,
        missingRecipeLines,
        missingCostLines,
        negativeStockOverrideUsed: false
      },
      client
    );
  }

  static async processBillVoid(
    billId: string,
    voidRecordId: string,
    businessDate: string,
    adminId: string,
    client: PoolClient
  ): Promise<void> {
    const consumptions = await CostingRepository.findConsumptionsByBillId(billId, client);
    if (consumptions.length === 0) {
      return;
    }

    // Deterministic ascending lock
    const itemIds = Array.from(new Set(consumptions.map((c) => c.inventory_item_id))).sort((a, b) =>
      a.localeCompare(b)
    );
    for (const itemId of itemIds) {
      await StockRepository.lockAndGetBalance(itemId, client);
      await CostingRepository.lockAndGetCostState(itemId, client);
    }

    for (const c of consumptions) {
      const consumedQty = new Decimal(c.quantity_consumed);

      // 1. Post compensating BILL_VOID_RETURN movement
      await StockLedgerService.recordBillVoidReturn(
        {
          inventoryItemId: c.inventory_item_id,
          businessDate,
          quantityDelta: consumedQty,
          sourceId: voidRecordId,
          reason: `Bill void return`,
          createdBy: adminId
        },
        client
      );

      // 2. Cost basis restoration: ONLY if consumed quantity was on cost basis (unit_cost_snapshot IS NOT NULL)
      if (c.unit_cost_snapshot !== null) {
        const costState = await CostingRepository.lockAndGetCostState(c.inventory_item_id, client);
        const newBasis = new Decimal(costState.quantity_on_cost_basis).plus(consumedQty);
        await CostingRepository.updateCostState(
          c.inventory_item_id,
          new Decimal(costState.average_unit_cost),
          newBasis,
          client
        );
      }
      // If unit_cost_snapshot IS NULL, quantity_on_cost_basis remains untouched.
    }
  }

  static async recordPurchaseReceiptCost(
    lines: Array<{
      inventoryItemId: string;
      quantity: string | number;
      unitRate: string | number;
    }>,
    client: PoolClient
  ): Promise<void> {
    const sortedLines = [...lines].sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId));

    for (const line of sortedLines) {
      const costState = await CostingRepository.lockAndGetCostState(line.inventoryItemId, client);
      const prevBasis = new Decimal(costState.quantity_on_cost_basis);
      const prevAvg = new Decimal(costState.average_unit_cost);
      const purchasedQty = new Decimal(line.quantity);
      const purchaseRate = new Decimal(line.unitRate);

      let newAvg: Decimal;
      let newBasis: Decimal;

      if (prevBasis.lte(0)) {
        newAvg = purchaseRate;
        newBasis = purchasedQty;
      } else {
        const prevTotal = prevBasis.times(prevAvg);
        const purchaseTotal = purchasedQty.times(purchaseRate);
        newBasis = prevBasis.plus(purchasedQty);
        newAvg = prevTotal.plus(purchaseTotal).dividedBy(newBasis).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      }

      await CostingRepository.updateCostState(line.inventoryItemId, newAvg, newBasis, client);
    }
  }
}
