import { InventoryBaseUnit } from '../inventory/inventory.types';

export type StockMovementType =
  | 'OPENING'
  | 'PURCHASE_RECEIPT'
  | 'PURCHASE_REVERSAL'
  | 'MANUAL_INCREASE'
  | 'MANUAL_DECREASE'
  | 'WASTAGE'
  | 'MANUAL_CONSUMPTION'
  | 'COUNT_CORRECTION';

export interface StockMovement {
  id: string;
  inventory_item_id: string;
  inventoryItemId?: string;
  business_date: string;
  businessDate?: string;
  movement_type: StockMovementType;
  movementType?: StockMovementType;
  quantity_delta: string;
  quantityDelta?: string;
  unit_cost: string | null;
  unitCost?: string | null;
  source_type: string;
  sourceType?: string;
  source_id: string;
  sourceId?: string;
  reason: string | null;
  created_by: string | null;
  createdBy?: string | null;
  created_at: string | Date;
  createdAt?: string | Date;
}

export interface InventoryBalance {
  inventory_item_id: string;
  inventoryItemId?: string;
  available_quantity: string;
  availableQuantity?: string;
  last_movement_at: string | Date;
  lastMovementAt?: string | Date;
  updated_at: string | Date;
  updatedAt?: string | Date;
}

export interface StockCount {
  id: string;
  inventory_item_id: string;
  inventoryItemId?: string;
  business_date: string;
  businessDate?: string;
  expected_quantity: string;
  expectedQuantity?: string;
  actual_quantity: string;
  actualQuantity?: string;
  variance_quantity: string;
  varianceQuantity?: string;
  reason: string | null;
  counted_by: string;
  countedBy?: string;
  confirmed_at: string | Date;
  confirmedAt?: string | Date;
}

export interface RecordOpeningStockDTO {
  inventoryItemId: string;
  businessDate?: string;
  quantity: number | string;
  note?: string;
  sourceId?: string;
  idempotencyKey?: string;
}

export interface RecordAdjustmentDTO {
  inventoryItemId: string;
  businessDate?: string;
  type: 'MANUAL_INCREASE' | 'MANUAL_DECREASE' | 'WASTAGE' | 'MANUAL_CONSUMPTION';
  quantity: number | string;
  reason?: string;
  idempotencyKey?: string;
}

export interface RecordStockCountDTO {
  inventoryItemId: string;
  businessDate?: string;
  actualQuantity: number | string;
  reason?: string;
  idempotencyKey?: string;
}

export interface RecordPurchaseReceiptInput {
  purchaseId: string;
  purchaseNumber: string;
  purchaseLineId: string;
  inventoryItemId: string;
  quantity: number | string;
  unitCost: number | string;
  adminId: string;
  businessDate: string;
}

export interface RecordPurchaseReversalInput {
  purchaseId: string;
  purchaseNumber: string;
  purchaseLineId: string;
  inventoryItemId: string;
  quantity: number | string;
  reason: string;
  adminId: string;
  businessDate: string;
}

export interface StockMovementResult {
  movementId: string;
  inventoryItemId: string;
  quantityDelta: string;
  resultingBalance: string;
}

export interface ItemStockSummary {
  inventoryItemId: string;
  name: string;
  baseUnit: InventoryBaseUnit;
  availableQuantity: string;
  minimumStock: string;
  isLowStock: boolean;
  lastMovementAt: string | Date | null;
}

export interface StockMovementListParams {
  itemId?: string;
  from?: string;
  to?: string;
  type?: StockMovementType;
  page?: number | string;
  pageSize?: number | string;
}

export interface StockMovementPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface StockMovementListResult {
  items: StockMovement[];
  pagination: StockMovementPagination;
}
