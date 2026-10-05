import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RecipeService } from '@/modules/recipe/recipe.service';
import { RecipeRepository } from '@/modules/recipe/recipe.repository';
import { query } from '@/shared/database/client';
import {
  RecipeVersionNotDraftError,
  RecipeConflictError,
  IngredientArchivedError,
  MenuItemArchivedError,
  IdempotencyError
} from '@/shared/errors';

describe('RecipeService Activation & Deactivation Integration Tests', () => {
  const testAdminId = '00000000-0000-0000-0000-000000000001';
  let testCategoryId: string;
  let testMenuItemId: string;
  let testInventoryItemId1: string;
  let testInventoryItemId2: string;

  const testRunId = Date.now();
  const keyActV1 = `test-idem-act-v1-${testRunId}`;
  const keyActV2 = `test-idem-act-v2-${testRunId}`;
  const keyDeactV2 = `test-idem-deact-v2-${testRunId}`;

  beforeAll(async () => {
    // 0. Clean old test idempotency keys
    await query(`DELETE FROM idempotency WHERE key LIKE 'test-idem-%'`);

    // 1. Ensure test admin exists
    await query(
      `
      INSERT INTO admins (id, email, password_hash, display_name)
      VALUES ($1, 'recipe_act_test@cafe.com', 'hash', 'Test Admin')
      ON CONFLICT (id) DO NOTHING;
    `,
      [testAdminId]
    );

    // 2. Create test category
    const catRes = await query(
      `
      INSERT INTO menu_categories (name, display_order)
      VALUES ('TEST_Act_Cat', 997)
      RETURNING id;
    `
    );
    testCategoryId = catRes.rows[0].id;

    // 3. Create test menu item
    const menuRes = await query(
      `
      INSERT INTO menu_items (category_id, name, selling_price, is_available, is_archived)
      VALUES ($1, 'TEST_Act_Pasta', 180.00, TRUE, FALSE)
      RETURNING id;
    `,
      [testCategoryId]
    );
    testMenuItemId = menuRes.rows[0].id;

    // 4. Create test inventory items
    const inv1Res = await query(
      `
      INSERT INTO inventory_items (name, item_type, base_unit, minimum_stock, is_archived)
      VALUES ('TEST_Pasta_Penne', 'RAW_MATERIAL', 'KG', 10.000, FALSE)
      RETURNING id;
    `
    );
    testInventoryItemId1 = inv1Res.rows[0].id;

    const inv2Res = await query(
      `
      INSERT INTO inventory_items (name, item_type, base_unit, minimum_stock, is_archived)
      VALUES ('TEST_Tomato_Sauce', 'RAW_MATERIAL', 'KG', 5.000, FALSE)
      RETURNING id;
    `
    );
    testInventoryItemId2 = inv2Res.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await query(`DELETE FROM idempotency WHERE key LIKE 'test-idem-%'`);
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

  it('activates draft v1, sets effective_from, and updates parent recipe to ACTIVE', async () => {
    // 1. Create draft v1
    const draftV1 = await RecipeService.createDraft(
      testMenuItemId,
      {
        ingredients: [
          { inventoryItemId: testInventoryItemId1, quantity: 0.15, wastageAllowancePct: 2 },
          { inventoryItemId: testInventoryItemId2, quantity: 0.1 }
        ],
        note: 'Penne Arrabiata v1'
      },
      testAdminId
    );

    expect(draftV1.status).toBe('DRAFT');

    // 2. Activate v1
    const activatedV1 = await RecipeService.activateVersion(
      draftV1.id,
      { confirm: true },
      testAdminId,
      keyActV1
    );

    expect(activatedV1.id).toBe(draftV1.id);
    expect(activatedV1.status).toBe('ACTIVE');
    expect(activatedV1.effectiveFrom).not.toBeNull();
    expect(activatedV1.supersededAt).toBeNull();

    // 3. Verify parent recipe status is ACTIVE and points to v1
    const parentRecipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    expect(parentRecipe?.status).toBe('ACTIVE');
    expect(parentRecipe?.active_version_id).toBe(draftV1.id);

    // 4. Verify audit event
    const auditRes = await query(
      `SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'RECIPE_VERSION_ACTIVATED'`,
      [draftV1.id]
    );
    expect(auditRes.rows.length).toBe(1);
  });

  it('replays activation idempotently when using the same idempotency key', async () => {
    const parentRecipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const activeVersionId = parentRecipe!.active_version_id!;

    // Replay with identical key & payload
    const replayed = await RecipeService.activateVersion(
      activeVersionId,
      { confirm: true },
      testAdminId,
      keyActV1
    );

    expect(replayed.id).toBe(activeVersionId);
    expect(replayed.status).toBe('ACTIVE');

    // Replay with payload mismatch throws IdempotencyError
    await expect(
      RecipeService.activateVersion(
        activeVersionId,
        { confirm: false },
        testAdminId,
        keyActV1
      )
    ).rejects.toThrow(IdempotencyError);
  });

  it('atomically supersedes v1 when activating draft v2', async () => {
    const parentRecipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const v1Id = parentRecipe!.active_version_id!;

    // 1. Create draft v2
    const draftV2 = await RecipeService.createDraft(
      testMenuItemId,
      {
        ingredients: [
          { inventoryItemId: testInventoryItemId1, quantity: 0.18, wastageAllowancePct: 1 },
          { inventoryItemId: testInventoryItemId2, quantity: 0.12 }
        ],
        note: 'Penne Arrabiata v2 with more sauce'
      },
      testAdminId
    );

    expect(draftV2.versionNumber).toBe(2);
    expect(draftV2.status).toBe('DRAFT');

    // 2. Activate v2
    const activatedV2 = await RecipeService.activateVersion(
      draftV2.id,
      { confirm: true },
      testAdminId,
      keyActV2
    );

    expect(activatedV2.id).toBe(draftV2.id);
    expect(activatedV2.status).toBe('ACTIVE');
    expect(activatedV2.effectiveFrom).not.toBeNull();

    // 3. Verify v1 is now SUPERSEDED
    const historicV1 = await RecipeRepository.findVersionById(v1Id);
    expect(historicV1?.status).toBe('SUPERSEDED');
    expect(historicV1?.superseded_at).not.toBeNull();

    // 4. Verify parent recipe points to v2
    const updatedRecipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    expect(updatedRecipe?.active_version_id).toBe(draftV2.id);
    expect(updatedRecipe?.status).toBe('ACTIVE');

    // 5. Verify v1 can no longer be activated or edited
    await expect(
      RecipeService.activateVersion(v1Id, { confirm: true }, testAdminId)
    ).rejects.toThrow(RecipeVersionNotDraftError);

    await expect(
      RecipeService.updateDraft(
        v1Id,
        { ingredients: [{ inventoryItemId: testInventoryItemId1, quantity: 0.5 }] },
        testAdminId
      )
    ).rejects.toThrow(RecipeVersionNotDraftError);
  });

  it('rejects activation if an ingredient was archived before activation', async () => {
    // 1. Create draft v3
    const draftV3 = await RecipeService.createDraft(
      testMenuItemId,
      {
        ingredients: [{ inventoryItemId: testInventoryItemId1, quantity: 0.2 }],
        note: 'Penne Arrabiata v3'
      },
      testAdminId
    );

    // 2. Archive the inventory item
    await query(`UPDATE inventory_items SET is_archived = TRUE WHERE id = $1`, [testInventoryItemId1]);

    // 3. Attempt to activate v3 -> must reject with IngredientArchivedError
    await expect(
      RecipeService.activateVersion(draftV3.id, { confirm: true }, testAdminId)
    ).rejects.toThrow(IngredientArchivedError);

    // Restore inventory item
    await query(`UPDATE inventory_items SET is_archived = FALSE WHERE id = $1`, [testInventoryItemId1]);
  });

  it('rejects activation if parent menu item was archived before activation', async () => {
    const parentRecipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const draftV3 = await RecipeRepository.findVersionByRecipeAndNumber(parentRecipe!.id, 3);

    // Archive menu item
    await query(`UPDATE menu_items SET is_archived = TRUE WHERE id = $1`, [testMenuItemId]);

    // Attempt to activate v3 -> must reject with MenuItemArchivedError
    await expect(
      RecipeService.activateVersion(draftV3!.id, { confirm: true }, testAdminId)
    ).rejects.toThrow(MenuItemArchivedError);

    // Restore menu item
    await query(`UPDATE menu_items SET is_archived = FALSE WHERE id = $1`, [testMenuItemId]);
  });

  it('deactivates active version v2, clears active pointer, and records reason', async () => {
    const parentRecipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const activeV2Id = parentRecipe!.active_version_id!;

    // 1. Deactivate v2
    const deactRes = await RecipeService.deactivateVersion(
      activeV2Id,
      { confirm: true, reason: 'Temporary kitchen stockout' },
      testAdminId,
      keyDeactV2
    );

    expect(deactRes.versionId).toBe(activeV2Id);
    expect(deactRes.status).toBe('INACTIVE');

    // 2. Verify version v2 is INACTIVE and has reason appended in note
    const v2Record = await RecipeRepository.findVersionById(activeV2Id);
    expect(v2Record?.status).toBe('INACTIVE');
    expect(v2Record?.superseded_at).not.toBeNull();
    expect(v2Record?.note).toContain('Deactivated: Temporary kitchen stockout');

    // 3. Verify parent recipe has active_version_id = NULL and status = INACTIVE
    const updatedRecipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    expect(updatedRecipe?.active_version_id).toBeNull();
    expect(updatedRecipe?.status).toBe('INACTIVE');

    // 4. Verify audit event
    const auditRes = await query(
      `SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'RECIPE_VERSION_DEACTIVATED'`,
      [activeV2Id]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].metadata?.reason).toBe('Temporary kitchen stockout');
  });

  it('replays deactivation idempotently', async () => {
    const parentRecipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const v2Record = await RecipeRepository.findVersionByRecipeAndNumber(parentRecipe!.id, 2);

    const replayed = await RecipeService.deactivateVersion(
      v2Record!.id,
      { confirm: true, reason: 'Temporary kitchen stockout' },
      testAdminId,
      keyDeactV2
    );

    expect(replayed.versionId).toBe(v2Record!.id);
    expect(replayed.status).toBe('INACTIVE');
  });

  it('rejects deactivating a non-active version', async () => {
    const parentRecipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const v1Record = await RecipeRepository.findVersionByRecipeAndNumber(parentRecipe!.id, 1);
    const v3Draft = await RecipeRepository.findVersionByRecipeAndNumber(parentRecipe!.id, 3);

    // Attempt to deactivate SUPERSEDED v1
    await expect(
      RecipeService.deactivateVersion(v1Record!.id, { confirm: true, reason: 'Attempt to deactivate superseded' }, testAdminId)
    ).rejects.toThrow(RecipeConflictError);

    // Attempt to deactivate DRAFT v3
    await expect(
      RecipeService.deactivateVersion(v3Draft!.id, { confirm: true, reason: 'Attempt to deactivate draft' }, testAdminId)
    ).rejects.toThrow(RecipeConflictError);
  });

  it('rejects deactivating when reason is missing or empty', async () => {
    const parentRecipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const v1Record = await RecipeRepository.findVersionByRecipeAndNumber(parentRecipe!.id, 1);

    await expect(
      RecipeService.deactivateVersion(v1Record!.id, { confirm: true } as any, testAdminId)
    ).rejects.toThrow();

    await expect(
      RecipeService.deactivateVersion(v1Record!.id, { confirm: true, reason: '   ' } as any, testAdminId)
    ).rejects.toThrow();
  });

  it('handles concurrent activations safely with row-level locking', async () => {
    const parentRecipe = await RecipeRepository.findRecipeByMenuItemId(testMenuItemId);
    const draftV3 = await RecipeRepository.findVersionByRecipeAndNumber(parentRecipe!.id, 3);

    // Launch two parallel activation requests for draft v3
    const p1 = RecipeService.activateVersion(draftV3!.id, { confirm: true }, testAdminId);
    const p2 = RecipeService.activateVersion(draftV3!.id, { confirm: true }, testAdminId);

    const results = await Promise.allSettled([p1, p2]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed, and the other must reject with RecipeVersionNotDraftError
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(RecipeVersionNotDraftError);

    // Confirm v3 is now ACTIVE
    const v3After = await RecipeRepository.findVersionById(draftV3!.id);
    expect(v3After?.status).toBe('ACTIVE');
  });
});
