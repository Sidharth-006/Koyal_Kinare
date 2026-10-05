import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RecipeService } from '@/modules/recipe/recipe.service';
import { RecipeRepository } from '@/modules/recipe/recipe.repository';
import { query } from '@/shared/database/client';
import {
  MenuItemArchivedError,
  IngredientArchivedError,
  RecipeVersionNotDraftError,
  DuplicateRecipeIngredientError,
  NotFoundError
} from '@/shared/errors';

describe('RecipeService Draft Management Integration Tests', () => {
  const testAdminId = '00000000-0000-0000-0000-000000000001';
  let testCategoryId: string;
  let testActiveMenuItemId: string;
  let testArchivedMenuItemId: string;
  let testActiveInventoryId1: string;
  let testActiveInventoryId2: string;
  let testArchivedInventoryId: string;

  beforeAll(async () => {
    // 1. Ensure test admin exists
    await query(
      `
      INSERT INTO admins (id, email, password_hash, display_name)
      VALUES ($1, 'recipe_service_test@cafe.com', 'hash', 'Test Admin')
      ON CONFLICT (id) DO NOTHING;
    `,
      [testAdminId]
    );

    // 2. Create test category
    const catRes = await query(
      `
      INSERT INTO menu_categories (name, display_order)
      VALUES ('TEST_Service_Cat', 998)
      RETURNING id;
    `
    );
    testCategoryId = catRes.rows[0].id;

    // 3. Create test active and archived menu items
    const activeMenuRes = await query(
      `
      INSERT INTO menu_items (category_id, name, selling_price, is_available, is_archived)
      VALUES ($1, 'TEST_Service_Pizza', 250.00, TRUE, FALSE)
      RETURNING id;
    `,
      [testCategoryId]
    );
    testActiveMenuItemId = activeMenuRes.rows[0].id;

    const archivedMenuRes = await query(
      `
      INSERT INTO menu_items (category_id, name, selling_price, is_available, is_archived)
      VALUES ($1, 'TEST_Archived_Pizza', 200.00, TRUE, TRUE)
      RETURNING id;
    `,
      [testCategoryId]
    );
    testArchivedMenuItemId = archivedMenuRes.rows[0].id;

    // 4. Create test active and archived inventory items
    const inv1Res = await query(
      `
      INSERT INTO inventory_items (name, item_type, base_unit, minimum_stock, is_archived)
      VALUES ('TEST_Flour_Base', 'RAW_MATERIAL', 'KG', 5.000, FALSE)
      RETURNING id;
    `
    );
    testActiveInventoryId1 = inv1Res.rows[0].id;

    const inv2Res = await query(
      `
      INSERT INTO inventory_items (name, item_type, base_unit, minimum_stock, is_archived)
      VALUES ('TEST_Mozzarella_Cheese', 'RAW_MATERIAL', 'KG', 2.000, FALSE)
      RETURNING id;
    `
    );
    testActiveInventoryId2 = inv2Res.rows[0].id;

    const invArchivedRes = await query(
      `
      INSERT INTO inventory_items (name, item_type, base_unit, minimum_stock, is_archived)
      VALUES ('TEST_Discontinued_Spice', 'RAW_MATERIAL', 'G', 100.000, TRUE)
      RETURNING id;
    `
    );
    testArchivedInventoryId = invArchivedRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (testActiveMenuItemId) {
      await query(`DELETE FROM recipes WHERE menu_item_id = $1`, [testActiveMenuItemId]);
      await query(`DELETE FROM menu_items WHERE id = $1`, [testActiveMenuItemId]);
    }
    if (testArchivedMenuItemId) {
      await query(`DELETE FROM menu_items WHERE id = $1`, [testArchivedMenuItemId]);
    }
    if (testCategoryId) {
      await query(`DELETE FROM menu_categories WHERE id = $1`, [testCategoryId]);
    }
    if (testActiveInventoryId1) {
      await query(`DELETE FROM inventory_items WHERE id = $1`, [testActiveInventoryId1]);
    }
    if (testActiveInventoryId2) {
      await query(`DELETE FROM inventory_items WHERE id = $1`, [testActiveInventoryId2]);
    }
    if (testArchivedInventoryId) {
      await query(`DELETE FROM inventory_items WHERE id = $1`, [testArchivedInventoryId]);
    }
  });

  it('creates a new draft version, seeds parent recipe as INACTIVE, and resolves snapshots server-side', async () => {
    const draft = await RecipeService.createDraft(
      testActiveMenuItemId,
      {
        ingredients: [
          {
            inventoryItemId: testActiveInventoryId1,
            quantity: 0.2,
            wastageAllowancePct: 2.5,
            note: 'Dough base'
          },
          {
            inventoryItemId: testActiveInventoryId2,
            quantity: 0.15,
            wastageAllowancePct: 0
          }
        ],
        note: 'Version 1 Pizza recipe'
      },
      testAdminId
    );

    expect(draft).toBeDefined();
    expect(draft.id).toBeDefined();
    expect(draft.versionNumber).toBe(1);
    expect(draft.status).toBe('DRAFT');
    expect(draft.note).toBe('Version 1 Pizza recipe');
    expect(draft.ingredients.length).toBe(2);

    // Verify snapshots were resolved server-side from inventory_items
    const flourIng = draft.ingredients.find((i) => i.inventoryItemId === testActiveInventoryId1);
    expect(flourIng?.itemName).toBe('TEST_Flour_Base');
    expect(flourIng?.unit).toBe('KG');
    expect(flourIng?.quantity).toBe('0.200');
    expect(flourIng?.wastageAllowancePct).toBe('2.50');
    expect(flourIng?.note).toBe('Dough base');

    // Verify parent recipe exists with status INACTIVE and active_version_id NULL
    const parentRecipe = await RecipeRepository.findRecipeByMenuItemId(testActiveMenuItemId);
    expect(parentRecipe).not.toBeNull();
    expect(parentRecipe?.status).toBe('INACTIVE');
    expect(parentRecipe?.active_version_id).toBeNull();

    // Verify audit log was written
    const auditRes = await query(
      `SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'RECIPE_VERSION_DRAFT_CREATED'`,
      [draft.id]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].admin_id).toBe(testAdminId);
  });

  it('rejects draft creation for an archived menu item', async () => {
    await expect(
      RecipeService.createDraft(
        testArchivedMenuItemId,
        {
          ingredients: [{ inventoryItemId: testActiveInventoryId1, quantity: 1 }]
        },
        testAdminId
      )
    ).rejects.toThrow(MenuItemArchivedError);
  });

  it('rejects draft creation if any ingredient is archived', async () => {
    await expect(
      RecipeService.createDraft(
        testActiveMenuItemId,
        {
          ingredients: [
            { inventoryItemId: testActiveInventoryId1, quantity: 1 },
            { inventoryItemId: testArchivedInventoryId, quantity: 50 }
          ]
        },
        testAdminId
      )
    ).rejects.toThrow(IngredientArchivedError);
  });

  it('rejects duplicate ingredient entries in the same payload', async () => {
    await expect(
      RecipeService.createDraft(
        testActiveMenuItemId,
        {
          ingredients: [
            { inventoryItemId: testActiveInventoryId1, quantity: 0.1 },
            { inventoryItemId: testActiveInventoryId1, quantity: 0.2 }
          ]
        },
        testAdminId
      )
    ).rejects.toThrow(DuplicateRecipeIngredientError);
  });

  it('updates an unactivated draft version cleanly', async () => {
    const recipe = await RecipeRepository.findRecipeByMenuItemId(testActiveMenuItemId);
    const draftV1 = await RecipeRepository.findVersionByRecipeAndNumber(recipe!.id, 1);
    expect(draftV1).not.toBeNull();

    const updated = await RecipeService.updateDraft(
      draftV1!.id,
      {
        ingredients: [
          {
            inventoryItemId: testActiveInventoryId1,
            quantity: 0.25,
            wastageAllowancePct: 3.0,
            note: 'Updated crust weight'
          }
        ],
        note: 'Refined recipe note'
      },
      testAdminId
    );

    expect(updated.id).toBe(draftV1!.id);
    expect(updated.note).toBe('Refined recipe note');
    expect(updated.ingredients.length).toBe(1);
    expect(updated.ingredients[0].inventoryItemId).toBe(testActiveInventoryId1);
    expect(updated.ingredients[0].quantity).toBe('0.250');
    expect(updated.ingredients[0].wastageAllowancePct).toBe('3.00');

    // Verify audit log for update
    const auditRes = await query(
      `SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'RECIPE_VERSION_UPDATED'`,
      [draftV1!.id]
    );
    expect(auditRes.rows.length).toBe(1);
  });

  it('rejects updating a version if it is NOT in DRAFT status', async () => {
    const recipe = await RecipeRepository.findRecipeByMenuItemId(testActiveMenuItemId);
    const draftV1 = await RecipeRepository.findVersionByRecipeAndNumber(recipe!.id, 1);

    // Simulate activating the version manually in DB
    await query(`UPDATE recipe_versions SET status = 'ACTIVE' WHERE id = $1`, [draftV1!.id]);

    await expect(
      RecipeService.updateDraft(
        draftV1!.id,
        {
          ingredients: [{ inventoryItemId: testActiveInventoryId1, quantity: 1 }]
        },
        testAdminId
      )
    ).rejects.toThrow(RecipeVersionNotDraftError);

    // Revert status back to DRAFT for subsequent tests
    await query(`UPDATE recipe_versions SET status = 'DRAFT' WHERE id = $1`, [draftV1!.id]);
  });

  it('retrieves recipe details, active version, draft version, and version history', async () => {
    const result = await RecipeService.getRecipeForMenuItem(testActiveMenuItemId);

    expect(result.recipe).toBeDefined();
    expect(result.recipe?.menuItemId).toBe(testActiveMenuItemId);
    expect(result.draftVersion).toBeDefined();
    expect(result.draftVersion?.versionNumber).toBe(1);
    expect(result.activeVersion).toBeNull(); // Still unactivated
    expect(result.versions.length).toBe(1);
  });

  it('lists recipe coverage and filters missing recipes', async () => {
    const listRes = await RecipeService.listRecipes({
      missingOnly: 'true',
      page: 1
    });

    expect(listRes.recipes).toBeDefined();
    expect(listRes.pagination).toBeDefined();

    // Since testActiveMenuItemId has no ACTIVE version yet, it must be listed under missingOnly
    const item = listRes.recipes.find((r) => r.menuItemId === testActiveMenuItemId);
    expect(item).toBeDefined();
    expect(item?.hasActiveRecipe).toBe(false);
  });
});
