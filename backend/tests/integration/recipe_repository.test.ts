import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RecipeRepository } from '@/modules/recipe/recipe.repository';
import { query, withTransaction } from '@/shared/database/client';

describe('RecipeRepository Integration Tests', () => {
  const testAdminId = '00000000-0000-0000-0000-000000000001';
  let testCategoryId: string;
  let testMenuItemId: string;
  let testInventoryItemId1: string;
  let testInventoryItemId2: string;

  beforeAll(async () => {
    // 1. Ensure test admin exists
    await query(
      `
      INSERT INTO admins (id, email, password_hash, display_name)
      VALUES ($1, 'recipe_repo_test@cafe.com', 'hash', 'Test Admin')
      ON CONFLICT (id) DO NOTHING;
    `,
      [testAdminId]
    );

    // 2. Create test category
    const catRes = await query(
      `
      INSERT INTO menu_categories (name, display_order)
      VALUES ('TEST_Recipe_Cat', 999)
      RETURNING id;
    `
    );
    testCategoryId = catRes.rows[0].id;

    // 3. Create test menu item
    const menuRes = await query(
      `
      INSERT INTO menu_items (category_id, name, selling_price, is_available)
      VALUES ($1, 'TEST_Recipe_Burger', 150.00, TRUE)
      RETURNING id;
    `,
      [testCategoryId]
    );
    testMenuItemId = menuRes.rows[0].id;

    // 4. Create test inventory items
    const inv1Res = await query(
      `
      INSERT INTO inventory_items (name, item_type, base_unit, minimum_stock)
      VALUES ('TEST_Burger_Bun', 'RAW_MATERIAL', 'PIECE', 10.000)
      RETURNING id;
    `
    );
    testInventoryItemId1 = inv1Res.rows[0].id;

    const inv2Res = await query(
      `
      INSERT INTO inventory_items (name, item_type, base_unit, minimum_stock)
      VALUES ('TEST_Cheese_Slice', 'RAW_MATERIAL', 'PIECE', 5.000)
      RETURNING id;
    `
    );
    testInventoryItemId2 = inv2Res.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (testMenuItemId) {
      await query(`DELETE FROM recipes WHERE menu_item_id = $1`, [testMenuItemId]);
      await query(`DELETE FROM menu_items WHERE id = $1`, [testMenuItemId]);
    }
    if (testCategoryId) {
      await query(`DELETE FROM menu_categories WHERE id = $1`, [testCategoryId]);
    }
    if (testInventoryItemId1) {
      await query(`DELETE FROM inventory_items WHERE id = $1`, [testInventoryItemId1]);
    }
    if (testInventoryItemId2) {
      await query(`DELETE FROM inventory_items WHERE id = $1`, [testInventoryItemId2]);
    }
  });

  it('creates and finds parent recipe for a menu item', async () => {
    // Check initially not found
    const initial = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    expect(initial).toBeNull();

    // Create recipe
    const created = await RecipeRepository.createRecipe({
      menuItemId: testMenuItemId,
      createdBy: testAdminId
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.menu_item_id).toBe(testMenuItemId);
    expect(created.status).toBe('INACTIVE');
    expect(created.active_version_id).toBeNull();

    // Find by ID and menu item ID
    const foundById = await RecipeRepository.findRecipeById(created.id);
    expect(foundById).toEqual(created);

    const foundByMenuId = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    expect(foundByMenuId).toEqual(created);
  });

  it('manages version creation, version numbers, and version lookup', async () => {
    const recipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    expect(recipe).not.toBeNull();

    // Next version number for brand new recipe should be 1
    const nextVer1 = await RecipeRepository.getNextVersionNumber(recipe!.id);
    expect(nextVer1).toBe(1);

    // Create draft version 1
    const v1 = await RecipeRepository.createVersion({
      recipeId: recipe!.id,
      versionNumber: 1,
      status: 'DRAFT',
      note: 'Initial prototype',
      createdBy: testAdminId
    });

    expect(v1.id).toBeDefined();
    expect(v1.version_number).toBe(1);
    expect(v1.status).toBe('DRAFT');
    expect(v1.note).toBe('Initial prototype');

    // Next version number should now be 2
    const nextVer2 = await RecipeRepository.getNextVersionNumber(recipe!.id);
    expect(nextVer2).toBe(2);

    // Create draft version 2
    const v2 = await RecipeRepository.createVersion({
      recipeId: recipe!.id,
      versionNumber: 2,
      status: 'DRAFT',
      note: 'Second prototype',
      createdBy: testAdminId
    });
    expect(v2.version_number).toBe(2);

    // Lookup version by ID and by recipe + number
    const foundV1 = await RecipeRepository.findVersionById(v1.id);
    expect(foundV1?.id).toBe(v1.id);

    const foundV2ByNum = await RecipeRepository.findVersionByRecipeAndNumber(recipe!.id, 2);
    expect(foundV2ByNum?.id).toBe(v2.id);

    // List all versions
    const allVersions = await RecipeRepository.listVersionsByRecipeId(recipe!.id);
    expect(allVersions.length).toBe(2);
    expect(allVersions[0].version_number).toBe(2); // DESC order
    expect(allVersions[1].version_number).toBe(1);
  });

  it('inserts, lists, and replaces version ingredients with frozen snapshots', async () => {
    const recipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const v1 = await RecipeRepository.findVersionByRecipeAndNumber(recipe!.id, 1);
    expect(v1).not.toBeNull();

    // Insert 2 ingredients into v1
    const inserted = await RecipeRepository.insertIngredients(v1!.id, [
      {
        inventoryItemId: testInventoryItemId1,
        itemNameSnapshot: 'TEST_Burger_Bun',
        unitSnapshot: 'PIECE',
        quantity: 2.0,
        wastageAllowancePct: 0.0,
        note: 'Top & bottom bun'
      },
      {
        inventoryItemId: testInventoryItemId2,
        itemNameSnapshot: 'TEST_Cheese_Slice',
        unitSnapshot: 'PIECE',
        quantity: 1.0,
        wastageAllowancePct: 5.0,
        note: 'Cheddar slice'
      }
    ]);

    expect(inserted.length).toBe(2);
    expect(inserted[0].item_name_snapshot).toBe('TEST_Burger_Bun');
    expect(inserted[0].unit_snapshot).toBe('PIECE');
    expect(inserted[0].quantity).toBe('2.000');
    expect(inserted[1].wastage_allowance_pct).toBe('5.00');

    // List ingredients
    const list = await RecipeRepository.listIngredientsByVersionId(v1!.id);
    expect(list.length).toBe(2);

    // Delete ingredients and verify empty
    await RecipeRepository.deleteIngredientsByVersionId(v1!.id);
    const afterDelete = await RecipeRepository.listIngredientsByVersionId(v1!.id);
    expect(afterDelete.length).toBe(0);

    // Re-insert for subsequent tests
    await RecipeRepository.insertIngredients(v1!.id, [
      {
        inventoryItemId: testInventoryItemId1,
        itemNameSnapshot: 'TEST_Burger_Bun',
        unitSnapshot: 'PIECE',
        quantity: 2.0,
        wastageAllowancePct: 0.0
      }
    ]);
  });

  it('updates version status, effective dates, and parent active pointer', async () => {
    const recipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const v1 = await RecipeRepository.findVersionByRecipeAndNumber(recipe!.id, 1);

    // 1. Activate v1
    const nowIso = new Date().toISOString();
    const updatedV1 = await RecipeRepository.updateVersionStatus({
      versionId: v1!.id,
      status: 'ACTIVE',
      effectiveFrom: nowIso
    });

    expect(updatedV1.status).toBe('ACTIVE');
    expect(updatedV1.effective_from).toBeDefined();

    // 2. Update parent recipe active version pointer and status
    const updatedRecipe = await RecipeRepository.updateRecipeActiveVersion({
      recipeId: recipe!.id,
      activeVersionId: v1!.id,
      status: 'ACTIVE'
    });

    expect(updatedRecipe.active_version_id).toBe(v1!.id);
    expect(updatedRecipe.status).toBe('ACTIVE');

    // 3. Verify findActiveVersionByRecipeId
    const activeVer = await RecipeRepository.findActiveVersionByRecipeId(recipe!.id);
    expect(activeVer?.id).toBe(v1!.id);

    // 4. Supersede v1 when deactivating/updating
    const supersededV1 = await RecipeRepository.updateVersionStatus({
      versionId: v1!.id,
      status: 'SUPERSEDED',
      supersededAt: new Date().toISOString()
    });
    expect(supersededV1.status).toBe('SUPERSEDED');
    expect(supersededV1.superseded_at).toBeDefined();

    // 5. Clear parent recipe active pointer
    const clearedRecipe = await RecipeRepository.updateRecipeActiveVersion({
      recipeId: recipe!.id,
      activeVersionId: null,
      status: 'INACTIVE'
    });
    expect(clearedRecipe.active_version_id).toBeNull();
    expect(clearedRecipe.status).toBe('INACTIVE');
  });

  it('supports row-level locking for recipes and versions inside a transaction', async () => {
    const recipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const v1 = await RecipeRepository.findVersionByRecipeAndNumber(recipe!.id, 1);

    await withTransaction(async (client) => {
      const lockedRecipe = await RecipeRepository.lockRecipeById(recipe!.id, client);
      expect(lockedRecipe).toBeDefined();
      expect(lockedRecipe?.id).toBe(recipe!.id);

      const lockedVersion = await RecipeRepository.lockVersionById(v1!.id, client);
      expect(lockedVersion).toBeDefined();
      expect(lockedVersion?.id).toBe(v1!.id);
    });
  });

  it('correctly reports recipe coverage and missing recipes', async () => {
    // Current testMenuItem has no active recipe (it was deactivated above)
    const missingCoverage = await RecipeRepository.listCoverage({
      missingOnly: true,
      page: 1,
      pageSize: 50
    });

    const foundMissing = missingCoverage.items.find((i) => i.menuItemId === testMenuItemId);
    expect(foundMissing).toBeDefined();
    expect(foundMissing?.hasActiveRecipe).toBe(false);

    // Now re-activate v1 on the recipe
    const recipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const v1 = await RecipeRepository.findVersionByRecipeAndNumber(recipe!.id, 1);

    await RecipeRepository.updateVersionStatus({
      versionId: v1!.id,
      status: 'ACTIVE',
      effectiveFrom: new Date().toISOString()
    });
    await RecipeRepository.updateRecipeActiveVersion({
      recipeId: recipe!.id,
      activeVersionId: v1!.id,
      status: 'ACTIVE'
    });

    // Coverage query with missingOnly=false
    const allCoverage = await RecipeRepository.listCoverage({
      missingOnly: false,
      page: 1,
      pageSize: 100
    });

    const foundActive = allCoverage.items.find((i) => i.menuItemId === testMenuItemId);
    expect(foundActive).toBeDefined();
    expect(foundActive?.hasActiveRecipe).toBe(true);
    expect(foundActive?.activeVersionNumber).toBe(1);
    expect(foundActive?.ingredientCount).toBe(1);

    // Under missingOnly=true, testMenuItemId must now NOT appear
    const afterActiveMissing = await RecipeRepository.listCoverage({
      missingOnly: true,
      page: 1,
      pageSize: 100
    });

    const shouldNotFind = afterActiveMissing.items.find((i) => i.menuItemId === testMenuItemId);
    expect(shouldNotFind).toBeUndefined();
  });
});
