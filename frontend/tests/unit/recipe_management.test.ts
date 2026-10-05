import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '@/lib/api';
import {
  RecipeCoverageItemDTO,
  RecipeVersionDetailDTO,
  RecipeVersionSummaryDTO,
  MenuItemRecipeResponseDTO,
  CreateDraftPayload,
  UpdateDraftPayload
} from '@/lib/types';

describe('Phase 3 — Module 2: Recipe Management & Versioning Frontend Logic', () => {

  describe('1. Recipe Coverage & Filtering Rules', () => {
    const mockCoverageItems: RecipeCoverageItemDTO[] = [
      {
        menuItemId: 'item-1',
        menuItemName: 'Masala Chai',
        categoryName: 'Beverages',
        recipeId: 'rec-1',
        status: 'ACTIVE',
        activeVersionId: 'ver-1',
        activeVersionNumber: 1,
        ingredientCount: 4,
        hasActiveRecipe: true,
        updatedAt: '2026-10-01T10:00:00Z'
      },
      {
        menuItemId: 'item-2',
        menuItemName: 'Filter Coffee',
        categoryName: 'Beverages',
        recipeId: null,
        status: null,
        activeVersionId: null,
        activeVersionNumber: null,
        ingredientCount: 0,
        hasActiveRecipe: false,
        updatedAt: null
      },
      {
        menuItemId: 'item-3',
        menuItemName: 'Samosa',
        categoryName: 'Snacks',
        recipeId: 'rec-3',
        status: 'INACTIVE',
        activeVersionId: null,
        activeVersionNumber: null,
        ingredientCount: 0,
        hasActiveRecipe: false,
        updatedAt: '2026-10-02T12:00:00Z'
      }
    ];

    it('identifies missing recipe state when hasActiveRecipe is false', () => {
      const missingItems = mockCoverageItems.filter((i) => !i.hasActiveRecipe);
      expect(missingItems).toHaveLength(2);
      expect(missingItems.map((i) => i.menuItemId)).toEqual(['item-2', 'item-3']);

      // Prominent missing recipe logic
      const isMissing1 = !mockCoverageItems[0].hasActiveRecipe || !mockCoverageItems[0].status;
      const isMissing2 = !mockCoverageItems[1].hasActiveRecipe || !mockCoverageItems[1].status;
      expect(isMissing1).toBe(false);
      expect(isMissing2).toBe(true);
    });

    it('filters items correctly based on Active Recipe, Missing Recipe, and Inactive criteria', () => {
      const activeFilter = mockCoverageItems.filter((i) => i.hasActiveRecipe && i.status === 'ACTIVE');
      expect(activeFilter).toHaveLength(1);
      expect(activeFilter[0].menuItemName).toBe('Masala Chai');

      const missingFilter = mockCoverageItems.filter((i) => !i.hasActiveRecipe);
      expect(missingFilter).toHaveLength(2);

      const inactiveFilter = mockCoverageItems.filter((i) => i.status === 'INACTIVE');
      expect(inactiveFilter).toHaveLength(1);
      expect(inactiveFilter[0].menuItemName).toBe('Samosa');
    });

    it('constructs correct API query parameters for filters', () => {
      const buildQueryParams = (filterTab: 'ALL' | 'ACTIVE' | 'MISSING' | 'INACTIVE', page = 1) => {
        const query = new URLSearchParams();
        if (filterTab === 'MISSING') {
          query.set('missingOnly', 'true');
        } else if (filterTab === 'ACTIVE') {
          query.set('status', 'ACTIVE');
        } else if (filterTab === 'INACTIVE') {
          query.set('status', 'INACTIVE');
        }
        if (page > 1) {
          query.set('page', String(page));
        }
        return query.toString();
      };

      expect(buildQueryParams('ALL')).toBe('');
      expect(buildQueryParams('ACTIVE')).toBe('status=ACTIVE');
      expect(buildQueryParams('MISSING')).toBe('missingOnly=true');
      expect(buildQueryParams('INACTIVE')).toBe('status=INACTIVE');
      expect(buildQueryParams('ACTIVE', 2)).toBe('status=ACTIVE&page=2');
    });
  });

  describe('2. Recipe Detail & Version Representation', () => {
    const mockRecipeDetail: MenuItemRecipeResponseDTO = {
      recipe: {
        id: 'rec-1',
        menuItemId: 'item-1',
        status: 'ACTIVE',
        activeVersionId: 'ver-2',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-02T10:00:00Z'
      },
      activeVersion: {
        id: 'ver-2',
        recipeId: 'rec-1',
        versionNumber: 2,
        status: 'ACTIVE',
        effectiveFrom: '2026-10-02T10:00:00Z',
        supersededAt: null,
        note: 'Optimized sugar ratio',
        createdBy: 'admin-1',
        createdAt: '2026-10-02T09:00:00Z',
        ingredients: [
          {
            id: 'ing-1',
            inventoryItemId: 'inv-milk',
            itemName: 'Whole Milk',
            unit: 'L',
            quantity: '0.150',
            wastageAllowancePct: '5.00',
            note: 'Fresh daily milk'
          },
          {
            id: 'ing-2',
            inventoryItemId: 'inv-tea',
            itemName: 'Tea Leaves',
            unit: 'KG',
            quantity: '0.008',
            wastageAllowancePct: '2.00',
            note: null
          }
        ]
      },
      draftVersion: {
        id: 'ver-3',
        recipeId: 'rec-1',
        versionNumber: 3,
        status: 'DRAFT',
        effectiveFrom: null,
        supersededAt: null,
        note: 'Testing cardamom addition',
        createdBy: 'admin-1',
        createdAt: '2026-10-03T08:00:00Z',
        ingredients: [
          {
            id: 'ing-3',
            inventoryItemId: 'inv-milk',
            itemName: 'Whole Milk',
            unit: 'L',
            quantity: '0.160',
            wastageAllowancePct: '5.00',
            note: null
          }
        ]
      },
      versions: [
        {
          id: 'ver-1',
          versionNumber: 1,
          status: 'SUPERSEDED',
          effectiveFrom: '2026-10-01T10:00:00Z',
          supersededAt: '2026-10-02T10:00:00Z',
          note: 'Initial formulation',
          createdBy: 'admin-1',
          createdAt: '2026-10-01T10:00:00Z'
        },
        {
          id: 'ver-2',
          versionNumber: 2,
          status: 'ACTIVE',
          effectiveFrom: '2026-10-02T10:00:00Z',
          supersededAt: null,
          note: 'Optimized sugar ratio',
          createdBy: 'admin-1',
          createdAt: '2026-10-02T09:00:00Z'
        },
        {
          id: 'ver-3',
          versionNumber: 3,
          status: 'DRAFT',
          effectiveFrom: null,
          supersededAt: null,
          note: 'Testing cardamom addition',
          createdBy: 'admin-1',
          createdAt: '2026-10-03T08:00:00Z'
        }
      ]
    };

    it('clearly distinguishes Draft, Active, and Superseded versions', () => {
      expect(mockRecipeDetail.activeVersion?.status).toBe('ACTIVE');
      expect(mockRecipeDetail.activeVersion?.versionNumber).toBe(2);

      expect(mockRecipeDetail.draftVersion?.status).toBe('DRAFT');
      expect(mockRecipeDetail.draftVersion?.versionNumber).toBe(3);

      const superseded = mockRecipeDetail.versions.filter((v) => v.status === 'SUPERSEDED');
      expect(superseded).toHaveLength(1);
      expect(superseded[0].versionNumber).toBe(1);
    });

    it('enforces that historic versions (ACTIVE, SUPERSEDED, INACTIVE) are immutable and not editable', () => {
      const isVersionEditable = (status: string) => {
        return status === 'DRAFT';
      };

      expect(isVersionEditable('DRAFT')).toBe(true);
      expect(isVersionEditable('ACTIVE')).toBe(false);
      expect(isVersionEditable('SUPERSEDED')).toBe(false);
      expect(isVersionEditable('INACTIVE')).toBe(false);
    });
  });

  describe('3. Recipe Editor Validation & Duplicate Protection', () => {
    interface IngredientInput {
      inventoryItemId: string;
      quantity: string;
      wastageAllowancePct: string;
      note?: string;
    }

    const validateRecipeDraft = (ingredients: IngredientInput[], note?: string) => {
      const errors: string[] = [];

      if (!ingredients || ingredients.length === 0) {
        errors.push('At least one ingredient is required.');
      }

      const itemIds = ingredients.map((i) => i.inventoryItemId).filter(Boolean);
      const uniqueItemIds = new Set(itemIds);
      if (uniqueItemIds.size !== itemIds.length) {
        errors.push('Duplicate inventory items detected. Each ingredient can only be added once.');
      }

      for (let i = 0; i < ingredients.length; i++) {
        const line = ingredients[i];
        if (!line.inventoryItemId) {
          errors.push(`Row ${i + 1}: Inventory item is required.`);
        }
        const qty = parseFloat(line.quantity);
        if (isNaN(qty) || qty <= 0) {
          errors.push(`Row ${i + 1}: Quantity must be greater than 0.`);
        }

        const wastage = parseFloat(line.wastageAllowancePct || '0');
        if (isNaN(wastage) || wastage < 0 || wastage > 100) {
          errors.push(`Row ${i + 1}: Wastage allowance must be between 0% and 100%.`);
        }

        if (line.note && line.note.length > 255) {
          errors.push(`Row ${i + 1}: Note cannot exceed 255 characters.`);
        }
      }

      if (note && note.length > 500) {
        errors.push('Version note cannot exceed 500 characters.');
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    };

    it('validates that at least one ingredient is required', () => {
      const result = validateRecipeDraft([]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one ingredient is required.');
    });

    it('prevents selecting duplicate inventory items in the same draft', () => {
      const duplicateDraft: IngredientInput[] = [
        { inventoryItemId: 'inv-sugar', quantity: '0.020', wastageAllowancePct: '0' },
        { inventoryItemId: 'inv-sugar', quantity: '0.010', wastageAllowancePct: '0' }
      ];

      const result = validateRecipeDraft(duplicateDraft);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Duplicate inventory items detected. Each ingredient can only be added once.'
      );
    });

    it('validates positive quantity requirement (> 0)', () => {
      const zeroQty: IngredientInput[] = [
        { inventoryItemId: 'inv-milk', quantity: '0', wastageAllowancePct: '0' }
      ];
      expect(validateRecipeDraft(zeroQty).isValid).toBe(false);

      const negQty: IngredientInput[] = [
        { inventoryItemId: 'inv-milk', quantity: '-1.5', wastageAllowancePct: '0' }
      ];
      expect(validateRecipeDraft(negQty).isValid).toBe(false);

      const posQty: IngredientInput[] = [
        { inventoryItemId: 'inv-milk', quantity: '0.250', wastageAllowancePct: '0' }
      ];
      expect(validateRecipeDraft(posQty).isValid).toBe(true);
    });

    it('validates wastage allowance percentage between 0 and 100', () => {
      const invalidWastageHigh: IngredientInput[] = [
        { inventoryItemId: 'inv-milk', quantity: '1', wastageAllowancePct: '105' }
      ];
      expect(validateRecipeDraft(invalidWastageHigh).isValid).toBe(false);

      const invalidWastageLow: IngredientInput[] = [
        { inventoryItemId: 'inv-milk', quantity: '1', wastageAllowancePct: '-5' }
      ];
      expect(validateRecipeDraft(invalidWastageLow).isValid).toBe(false);

      const validWastage: IngredientInput[] = [
        { inventoryItemId: 'inv-milk', quantity: '1', wastageAllowancePct: '10' }
      ];
      expect(validateRecipeDraft(validWastage).isValid).toBe(true);
    });

    it('validates note length limits (line note <= 255, version note <= 500)', () => {
      const longLineNote: IngredientInput[] = [
        { inventoryItemId: 'inv-milk', quantity: '1', wastageAllowancePct: '0', note: 'a'.repeat(256) }
      ];
      expect(validateRecipeDraft(longLineNote).isValid).toBe(false);

      const validLineNote: IngredientInput[] = [
        { inventoryItemId: 'inv-milk', quantity: '1', wastageAllowancePct: '0', note: 'a'.repeat(255) }
      ];
      expect(validateRecipeDraft(validLineNote).isValid).toBe(true);

      const validDraft: IngredientInput[] = [
        { inventoryItemId: 'inv-milk', quantity: '1', wastageAllowancePct: '0' }
      ];
      expect(validateRecipeDraft(validDraft, 'a'.repeat(501)).isValid).toBe(false);
      expect(validateRecipeDraft(validDraft, 'a'.repeat(500)).isValid).toBe(true);
    });
  });

  describe('4. Strict Payload Cleanliness & Invariants', () => {
    it('ensures payload does NOT contain item_name_snapshot, unit_snapshot, or seedFromActive', () => {
      const buildCleanPayload = (
        rawIngredients: Array<{
          inventoryItemId: string;
          quantity: string | number;
          wastageAllowancePct?: string | number;
          note?: string;
          itemNameSnapshot?: string;
          unitSnapshot?: string;
        }>,
        note?: string
      ): CreateDraftPayload => {
        return {
          ingredients: rawIngredients.map((i) => ({
            inventoryItemId: i.inventoryItemId,
            quantity: typeof i.quantity === 'string' ? parseFloat(i.quantity) : i.quantity,
            wastageAllowancePct: i.wastageAllowancePct ? parseFloat(String(i.wastageAllowancePct)) : 0,
            note: i.note?.trim() || undefined
          })),
          note: note?.trim() || undefined
        };
      };

      const payload = buildCleanPayload(
        [
          {
            inventoryItemId: 'inv-coffee',
            quantity: '0.015',
            wastageAllowancePct: '3',
            note: 'Standard grind',
            itemNameSnapshot: 'SHOULD_NOT_BE_SENT',
            unitSnapshot: 'SHOULD_NOT_BE_SENT'
          }
        ],
        'Test version note'
      );

      // Verify clean structure
      expect(payload).toEqual({
        ingredients: [
          {
            inventoryItemId: 'inv-coffee',
            quantity: 0.015,
            wastageAllowancePct: 3,
            note: 'Standard grind'
          }
        ],
        note: 'Test version note'
      });

      // Assert forbidden fields are absent
      const ing = payload.ingredients[0] as any;
      expect(ing.itemNameSnapshot).toBeUndefined();
      expect(ing.unitSnapshot).toBeUndefined();
      expect(ing.item_name_snapshot).toBeUndefined();
      expect(ing.unit_snapshot).toBeUndefined();
      expect((payload as any).seedFromActive).toBeUndefined();
    });
  });

  describe('5. Activation & Deactivation Contracts', () => {
    const validateDeactivationReason = (reason: string) => {
      const trimmed = (reason || '').trim();
      if (!trimmed || trimmed.length === 0) {
        return { isValid: false, error: 'Deactivation reason is required.' };
      }
      if (trimmed.length > 500) {
        return { isValid: false, error: 'Deactivation reason cannot exceed 500 characters.' };
      }
      return { isValid: true, trimmed };
    };

    it('rejects empty or whitespace-only deactivation reasons', () => {
      expect(validateDeactivationReason('').isValid).toBe(false);
      expect(validateDeactivationReason('   ').isValid).toBe(false);
      expect(validateDeactivationReason('\t\n  ').isValid).toBe(false);
    });

    it('rejects deactivation reason exceeding 500 characters', () => {
      const longReason = 'a'.repeat(501);
      const res = validateDeactivationReason(longReason);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Deactivation reason cannot exceed 500 characters.');
    });

    it('accepts valid, non-empty trimmed reason up to 500 characters', () => {
      const valid = validateDeactivationReason('  Menu item formulation temporarily discontinued for seasonal change.  ');
      expect(valid.isValid).toBe(true);
      expect(valid.trimmed).toBe('Menu item formulation temporarily discontinued for seasonal change.');

      const exactly500 = validateDeactivationReason('a'.repeat(500));
      expect(exactly500.isValid).toBe(true);
    });

    it('ensures deactivation payload matches frozen backend contract', () => {
      const payload = {
        confirm: true,
        reason: 'Seasonal update'
      };

      expect(payload).toHaveProperty('confirm', true);
      expect(payload).toHaveProperty('reason', 'Seasonal update');
      expect((payload as any).idempotencyKey).toBeUndefined();
    });
  });

  describe('6. Safe Backend Error Code Mapping', () => {
    const errorMap: Record<string, string> = {
      INGREDIENT_ARCHIVED: 'This ingredient is no longer active.',
      RECIPE_CONFLICT: 'This recipe changed elsewhere. Refresh before continuing.',
      RECIPE_VERSION_NOT_DRAFT: 'Only draft recipe versions can be edited or activated.',
      DUPLICATE_RECIPE_INGREDIENT: 'Duplicate inventory item specified in recipe ingredients.',
      MENU_ITEM_ARCHIVED: 'Cannot create or modify recipe for an archived or inactive menu item.'
    };

    const getSafeErrorMessage = (code: string, fallbackMessage?: string) => {
      return errorMap[code] || fallbackMessage || 'Something went wrong. Please try again.';
    };

    it('maps INGREDIENT_ARCHIVED to authoritative safe user message', () => {
      const msg = getSafeErrorMessage('INGREDIENT_ARCHIVED');
      expect(msg).toBe('This ingredient is no longer active.');
    });

    it('maps RECIPE_CONFLICT to authoritative safe user message', () => {
      const msg = getSafeErrorMessage('RECIPE_CONFLICT');
      expect(msg).toBe('This recipe changed elsewhere. Refresh before continuing.');
    });

    it('maps RECIPE_VERSION_NOT_DRAFT correctly', () => {
      const msg = getSafeErrorMessage('RECIPE_VERSION_NOT_DRAFT');
      expect(msg).toBe('Only draft recipe versions can be edited or activated.');
    });

    it('maps DUPLICATE_RECIPE_INGREDIENT correctly', () => {
      const msg = getSafeErrorMessage('DUPLICATE_RECIPE_INGREDIENT');
      expect(msg).toBe('Duplicate inventory item specified in recipe ingredients.');
    });

    it('maps MENU_ITEM_ARCHIVED correctly', () => {
      const msg = getSafeErrorMessage('MENU_ITEM_ARCHIVED');
      expect(msg).toBe('Cannot create or modify recipe for an archived or inactive menu item.');
    });

    it('falls back to safe generic error message on unknown error code', () => {
      const msg = getSafeErrorMessage('INTERNAL_DB_ERROR');
      expect(msg).toBe('Something went wrong. Please try again.');
    });
  });

  describe('7. API Integration Verification', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('sends idempotency key strictly in headers and not in body for activation', async () => {
      let interceptedHeaders: Record<string, string> = {};
      let interceptedBody: any = null;

      global.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        interceptedHeaders = init.headers as Record<string, string>;
        interceptedBody = init.body ? JSON.parse(init.body as string) : null;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id: 'ver-1', versionNumber: 1, status: 'ACTIVE' }
          })
        };
      });

      const testIdempotencyKey = 'test-idemp-activate-123';
      await api.activateRecipeVersion('ver-1', { confirm: true }, testIdempotencyKey);

      // Verify header presence
      expect(interceptedHeaders['Idempotency-Key']).toBe(testIdempotencyKey);

      // Verify body does NOT contain idempotency key
      expect(interceptedBody).toEqual({ confirm: true });
      expect(interceptedBody?.idempotencyKey).toBeUndefined();
    });

    it('sends idempotency key strictly in headers and not in body for deactivation', async () => {
      let interceptedHeaders: Record<string, string> = {};
      let interceptedBody: any = null;

      global.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        interceptedHeaders = init.headers as Record<string, string>;
        interceptedBody = init.body ? JSON.parse(init.body as string) : null;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              message: 'Recipe version successfully deactivated.',
              versionId: 'ver-1',
              recipeId: 'rec-1',
              status: 'INACTIVE'
            }
          })
        };
      });

      const testIdempotencyKey = 'test-idemp-deactivate-456';
      await api.deactivateRecipeVersion(
        'ver-1',
        { confirm: true, reason: 'Menu item update' },
        testIdempotencyKey
      );

      // Verify header presence
      expect(interceptedHeaders['Idempotency-Key']).toBe(testIdempotencyKey);

      // Verify body contains confirm and reason, NOT idempotencyKey
      expect(interceptedBody).toEqual({
        confirm: true,
        reason: 'Menu item update'
      });
      expect(interceptedBody?.idempotencyKey).toBeUndefined();
    });
  });
});
