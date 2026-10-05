export type RecipeStatus = 'ACTIVE' | 'INACTIVE';
export type RecipeVersionStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'INACTIVE';

export interface RecipeRecord {
  id: string;
  menu_item_id: string;
  active_version_id: string | null;
  status: RecipeStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeVersionRecord {
  id: string;
  recipe_id: string;
  version_number: number;
  status: RecipeVersionStatus;
  effective_from: string | null;
  superseded_at: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredientRecord {
  id: string;
  recipe_version_id: string;
  inventory_item_id: string;
  item_name_snapshot: string;
  unit_snapshot: string;
  quantity: string;
  wastage_allowance_pct: string;
  note: string | null;
  created_at: string;
}

export interface RecipeIngredientDTO {
  id: string;
  inventoryItemId: string;
  itemName: string;
  unit: string;
  quantity: string;
  wastageAllowancePct: string;
  note: string | null;
}

export interface RecipeVersionSummaryDTO {
  id: string;
  versionNumber: number;
  status: RecipeVersionStatus;
  effectiveFrom: string | null;
  supersededAt: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface RecipeVersionDetailDTO extends RecipeVersionSummaryDTO {
  recipeId: string;
  ingredients: RecipeIngredientDTO[];
}

export interface RecipeDTO {
  id: string;
  menuItemId: string;
  status: RecipeStatus;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemRecipeResponseDTO {
  recipe: RecipeDTO | null;
  activeVersion: RecipeVersionDetailDTO | null;
  draftVersion: RecipeVersionDetailDTO | null;
  versions: RecipeVersionSummaryDTO[];
}

export interface RecipeCoverageItemDTO {
  menuItemId: string;
  menuItemName: string;
  categoryName: string;
  recipeId: string | null;
  status: RecipeStatus | null;
  activeVersionId: string | null;
  activeVersionNumber: number | null;
  ingredientCount: number;
  hasActiveRecipe: boolean;
  updatedAt: string | null;
}

export interface RecipeListParams {
  status?: string;
  missingOnly?: string;
  page?: string | number;
}

export interface RecipeListResultDTO {
  recipes: RecipeCoverageItemDTO[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateDraftIngredientInput {
  inventoryItemId: string;
  quantity: number | string;
  wastageAllowancePct?: number | string;
  note?: string;
}

export interface CreateDraftPayload {
  ingredients: CreateDraftIngredientInput[];
  note?: string;
}

export interface UpdateDraftPayload {
  ingredients: CreateDraftIngredientInput[];
  note?: string;
}

export interface ActivateVersionPayload {
  confirm?: boolean;
}

export interface DeactivateVersionPayload {
  confirm?: boolean;
  reason: string;
}
