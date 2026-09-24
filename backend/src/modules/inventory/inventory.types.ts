export type InventoryItemType = 'RAW_MATERIAL' | 'PACKAGING' | 'BEVERAGE' | 'CONSUMABLE';
export type InventoryBaseUnit = 'KG' | 'G' | 'L' | 'ML' | 'PIECE' | 'PACKET' | 'BOX';

export interface InventoryItem {
  id: string;
  name: string;
  item_type: InventoryItemType;
  itemType?: InventoryItemType;
  base_unit: InventoryBaseUnit;
  baseUnit?: InventoryBaseUnit;
  minimum_stock: string | number;
  minimumStock?: string | number;
  description: string | null;
  is_archived: boolean;
  isArchived?: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateInventoryItemDTO {
  name: string;
  itemType: InventoryItemType;
  baseUnit: InventoryBaseUnit;
  minimumStock: number | string;
  description?: string;
  idempotencyKey?: string;
}

export interface UpdateInventoryItemDTO {
  name?: string;
  itemType?: InventoryItemType;
  baseUnit?: InventoryBaseUnit;
  minimumStock?: number | string;
  description?: string;
  idempotencyKey?: string;
}

export interface InventoryListParams {
  search?: string;
  type?: InventoryItemType;
  status?: 'active' | 'archived' | 'all';
  page?: number | string;
  pageSize?: number | string;
}

export interface InventoryListResult {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
