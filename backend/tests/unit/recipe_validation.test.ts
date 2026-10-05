import { describe, it, expect } from 'vitest';
import {
  createDraftSchema,
  createDraftIngredientSchema,
  recipeListParamsSchema,
  deactivateVersionSchema
} from '@/modules/recipe/recipe.schema';

describe('Recipe Validation Schemas (Unit Tests)', () => {
  const validUUID1 = '11111111-1111-1111-1111-111111111111';
  const validUUID2 = '22222222-2222-2222-2222-222222222222';

  describe('createDraftIngredientSchema', () => {
    it('accepts valid ingredient input', () => {
      const parsed = createDraftIngredientSchema.parse({
        inventoryItemId: validUUID1,
        quantity: 0.5,
        wastageAllowancePct: 5,
        note: 'Fresh cut'
      });
      expect(parsed.inventoryItemId).toBe(validUUID1);
      expect(parsed.quantity).toBe(0.5);
      expect(parsed.wastageAllowancePct).toBe(5);
      expect(parsed.note).toBe('Fresh cut');
    });

    it('defaults wastageAllowancePct to 0 when omitted', () => {
      const parsed = createDraftIngredientSchema.parse({
        inventoryItemId: validUUID1,
        quantity: 1
      });
      expect(parsed.wastageAllowancePct).toBe(0);
    });

    it('rejects invalid inventoryItemId UUID', () => {
      expect(() =>
        createDraftIngredientSchema.parse({
          inventoryItemId: 'not-a-uuid',
          quantity: 1
        })
      ).toThrow('Invalid inventory item ID format');
    });

    it('rejects zero or negative quantity', () => {
      expect(() =>
        createDraftIngredientSchema.parse({
          inventoryItemId: validUUID1,
          quantity: 0
        })
      ).toThrow('Quantity must be greater than 0');

      expect(() =>
        createDraftIngredientSchema.parse({
          inventoryItemId: validUUID1,
          quantity: -2.5
        })
      ).toThrow('Quantity must be greater than 0');
    });

    it('rejects negative wastage allowance or wastage > 100', () => {
      expect(() =>
        createDraftIngredientSchema.parse({
          inventoryItemId: validUUID1,
          quantity: 1,
          wastageAllowancePct: -1
        })
      ).toThrow('Wastage allowance cannot be negative');

      expect(() =>
        createDraftIngredientSchema.parse({
          inventoryItemId: validUUID1,
          quantity: 1,
          wastageAllowancePct: 101
        })
      ).toThrow('Wastage allowance cannot exceed 100%');
    });
  });

  describe('createDraftSchema', () => {
    it('accepts valid draft payload with at least one ingredient', () => {
      const parsed = createDraftSchema.parse({
        ingredients: [
          { inventoryItemId: validUUID1, quantity: 0.25 },
          { inventoryItemId: validUUID2, quantity: 1, wastageAllowancePct: 2.5 }
        ],
        note: 'Version note'
      });
      expect(parsed.ingredients.length).toBe(2);
      expect(parsed.note).toBe('Version note');
    });

    it('rejects empty ingredients array', () => {
      expect(() =>
        createDraftSchema.parse({
          ingredients: []
        })
      ).toThrow('At least one ingredient is required');
    });
  });

  describe('recipeListParamsSchema', () => {
    it('parses valid list parameters', () => {
      const parsed = recipeListParamsSchema.parse({
        status: 'ACTIVE',
        missingOnly: 'true',
        page: '2'
      });
      expect(parsed.status).toBe('ACTIVE');
      expect(parsed.missingOnly).toBe(true);
      expect(parsed.page).toBe(2);
    });

    it('defaults parameters safely when omitted', () => {
      const parsed = recipeListParamsSchema.parse({});
      expect(parsed.status).toBe('ALL');
      expect(parsed.missingOnly).toBe(false);
      expect(parsed.page).toBe(1);
    });

    it('rejects invalid status', () => {
      expect(() =>
        recipeListParamsSchema.parse({
          status: 'UNKNOWN_STATUS'
        })
      ).toThrow();
    });
  });

  describe('deactivateVersionSchema', () => {
    it('accepts valid payload with reason and optional confirm', () => {
      const parsed = deactivateVersionSchema.parse({
        confirm: true,
        reason: 'Menu revision for winter'
      });
      expect(parsed.confirm).toBe(true);
      expect(parsed.reason).toBe('Menu revision for winter');
    });

    it('rejects payload when reason is omitted or empty', () => {
      expect(() =>
        deactivateVersionSchema.parse({ confirm: true })
      ).toThrow('Deactivation reason is required');

      expect(() =>
        deactivateVersionSchema.parse({ confirm: true, reason: '   ' })
      ).toThrow('Deactivation reason is required');
    });

    it('rejects payload when reason exceeds 500 characters', () => {
      expect(() =>
        deactivateVersionSchema.parse({
          confirm: true,
          reason: 'A'.repeat(501)
        })
      ).toThrow('Deactivation reason cannot exceed 500 characters');
    });
  });
});
