export interface InventoryCostState {
  inventory_item_id: string;
  inventoryItemId?: string;
  average_unit_cost: string; // NUMERIC(14, 4)
  averageUnitCost?: string;
  quantity_on_cost_basis: string; // NUMERIC(14, 3)
  quantityOnCostBasis?: string;
  updated_at: string | Date;
  updatedAt?: string | Date;
}

export interface BillConsumption {
  id: string;
  bill_id: string;
  billId?: string;
  bill_line_id: string;
  billLineId?: string;
  inventory_item_id: string;
  inventoryItemId?: string;
  recipe_version_id: string;
  recipeVersionId?: string;
  quantity_consumed: string; // NUMERIC(14, 3)
  quantityConsumed?: string;
  unit_cost_snapshot: string | null; // NUMERIC(14, 4) or null
  unitCostSnapshot?: string | null;
  total_cost_snapshot: string | null; // NUMERIC(14, 4) or null
  totalCostSnapshot?: string | null;
  stock_movement_id: string;
  stockMovementId?: string;
  created_at: string | Date;
  createdAt?: string | Date;
  updated_at: string | Date;
  updatedAt?: string | Date;
}

export interface BillCostCoverage {
  bill_id: string;
  billId?: string;
  total_bill_lines: number;
  totalBillLines?: number;
  covered_lines: number;
  coveredLines?: number;
  missing_recipe_lines: number;
  missingRecipeLines?: number;
  missing_cost_lines: number;
  missingCostLines?: number;
  negative_stock_override_used: boolean;
  negativeStockOverrideUsed?: boolean;
  created_at: string | Date;
  createdAt?: string | Date;
  updated_at: string | Date;
  updatedAt?: string | Date;
}
