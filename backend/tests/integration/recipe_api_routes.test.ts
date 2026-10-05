import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { query } from '@/shared/database/client';
import { AuthRepository } from '@/modules/auth/auth.repository';
import { hashPassword, generateSessionToken } from '@/shared/auth/security';
import { createSessionCookie } from '@/shared/auth/session';

import { GET as listRecipesHandler } from '@/app/api/recipes/route';
import { GET as getMenuItemRecipeHandler } from '@/app/api/menu/items/[id]/recipe/route';
import { POST as createRecipeVersionHandler } from '@/app/api/menu/items/[id]/recipe/versions/route';
import { PATCH as updateRecipeVersionHandler } from '@/app/api/recipe-versions/[id]/route';
import { POST as activateRecipeVersionHandler } from '@/app/api/recipe-versions/[id]/activate/route';
import { POST as deactivateRecipeVersionHandler } from '@/app/api/recipe-versions/[id]/deactivate/route';

describe('Recipe API Route Handlers Integration Tests (Milestone 5)', { timeout: 35000 }, () => {
  let adminId: string;
  let authCookie: string;
  let testCategoryId: string;
  let testMenuItemId: string;
  let testArchivedMenuItemId: string;
  let testInventoryItem1: string;
  let testInventoryItem2: string;
  let createdDraftVersionId: string;
  let activeVersionId: string;

  beforeAll(async () => {
    // 1. Create test admin and valid session cookie
    const email = `recipe_api_admin_${Date.now()}@koyal.com`;
    const passwordHash = await hashPassword('AdminPass123!');
    const admin = await AuthRepository.createAdmin({
      email,
      passwordHash,
      displayName: 'Recipe API Admin'
    });
    adminId = admin.id;

    const { rawToken, tokenHash } = generateSessionToken();
    await AuthRepository.createSession({
      adminId: admin.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 86400 * 1000)
    });
    authCookie = createSessionCookie(rawToken);

    // 2. Create menu category
    const catRes = await query(
      `INSERT INTO menu_categories (name, display_order)
       VALUES ('API_Route_Category_${Date.now()}', 995)
       RETURNING id`
    );
    testCategoryId = catRes.rows[0].id;

    // 3. Create active and archived menu items
    const menuRes = await query(
      `INSERT INTO menu_items (category_id, name, selling_price, is_available, is_archived)
       VALUES ($1, 'API_Route_Burger_${Date.now()}', 180.00, TRUE, FALSE)
       RETURNING id`,
      [testCategoryId]
    );
    testMenuItemId = menuRes.rows[0].id;

    const menuArchivedRes = await query(
      `INSERT INTO menu_items (category_id, name, selling_price, is_available, is_archived)
       VALUES ($1, 'API_Route_Archived_${Date.now()}', 120.00, TRUE, TRUE)
       RETURNING id`,
      [testCategoryId]
    );
    testArchivedMenuItemId = menuArchivedRes.rows[0].id;

    // 4. Create active inventory items
    const inv1Res = await query(
      `INSERT INTO inventory_items (name, item_type, base_unit, minimum_stock, is_archived)
       VALUES ('API_Route_Bun_${Date.now()}', 'RAW_MATERIAL', 'KG', 10.000, FALSE)
       RETURNING id`
    );
    testInventoryItem1 = inv1Res.rows[0].id;

    const inv2Res = await query(
      `INSERT INTO inventory_items (name, item_type, base_unit, minimum_stock, is_archived)
       VALUES ('API_Route_Patty_${Date.now()}', 'RAW_MATERIAL', 'KG', 10.000, FALSE)
       RETURNING id`
    );
    testInventoryItem2 = inv2Res.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await query('DELETE FROM idempotency WHERE key LIKE $1', ['test-route-%']);
    await query('DELETE FROM recipes WHERE menu_item_id IN ($1, $2)', [testMenuItemId, testArchivedMenuItemId]);
    await query('DELETE FROM menu_items WHERE id IN ($1, $2)', [testMenuItemId, testArchivedMenuItemId]);
    await query('DELETE FROM menu_categories WHERE id = $1', [testCategoryId]);
    await query('DELETE FROM inventory_items WHERE id IN ($1, $2)', [testInventoryItem1, testInventoryItem2]);
    await query('DELETE FROM audit_logs WHERE admin_id = $1', [adminId]);
    await query('DELETE FROM sessions WHERE admin_id = $1', [adminId]);
    await query('DELETE FROM admins WHERE id = $1', [adminId]);
  });

  function createRequest(
    url: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      authenticated?: boolean;
    } = {}
  ): NextRequest {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(options.headers || {})
    };
    if (options.authenticated !== false) {
      headers['cookie'] = authCookie;
    }

    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
  }

  // =========================================================================
  // 1. AUTHENTICATION ENFORCEMENT ACROSS ALL 6 ROUTES
  // =========================================================================
  describe('Authentication Enforcement', () => {
    it('rejects unauthenticated GET /api/recipes with 401', async () => {
      const req = createRequest('http://localhost:3000/api/recipes', { authenticated: false });
      const res = await listRecipesHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated GET /api/menu/items/:id/recipe with 401', async () => {
      const req = createRequest(`http://localhost:3000/api/menu/items/${testMenuItemId}/recipe`, { authenticated: false });
      const res = await getMenuItemRecipeHandler(req, { params: { id: testMenuItemId } });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated POST /api/menu/items/:id/recipe/versions with 401', async () => {
      const req = createRequest(`http://localhost:3000/api/menu/items/${testMenuItemId}/recipe/versions`, {
        method: 'POST',
        body: { ingredients: [{ inventoryItemId: testInventoryItem1, quantity: 1 }] },
        authenticated: false
      });
      const res = await createRecipeVersionHandler(req, { params: { id: testMenuItemId } });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated PATCH /api/recipe-versions/:id with 401', async () => {
      const dummyId = '00000000-0000-0000-0000-000000000001';
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${dummyId}`, {
        method: 'PATCH',
        body: { note: 'Unauthorized update' },
        authenticated: false
      });
      const res = await updateRecipeVersionHandler(req, { params: { id: dummyId } });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated POST /api/recipe-versions/:id/activate with 401', async () => {
      const dummyId = '00000000-0000-0000-0000-000000000001';
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${dummyId}/activate`, {
        method: 'POST',
        authenticated: false
      });
      const res = await activateRecipeVersionHandler(req, { params: { id: dummyId } });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated POST /api/recipe-versions/:id/deactivate with 401', async () => {
      const dummyId = '00000000-0000-0000-0000-000000000001';
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${dummyId}/deactivate`, {
        method: 'POST',
        authenticated: false
      });
      const res = await deactivateRecipeVersionHandler(req, { params: { id: dummyId } });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // 2. ROUTE: GET /api/recipes
  // =========================================================================
  describe('GET /api/recipes', () => {
    it('returns paginated list of recipes with status and metadata', async () => {
      const req = createRequest('http://localhost:3000/api/recipes');
      const res = await listRecipesHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveProperty('recipes');
      expect(json.data).toHaveProperty('pagination');
      expect(Array.isArray(json.data.recipes)).toBe(true);
      expect(json.data.pagination).toHaveProperty('total');
      expect(json.data.pagination).toHaveProperty('page', 1);
    });

    it('supports status and missingOnly query parameters', async () => {
      const req = createRequest('http://localhost:3000/api/recipes?status=ACTIVE&missingOnly=false&page=1');
      const res = await listRecipesHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveProperty('recipes');
    });
  });

  // =========================================================================
  // 3. ROUTE: GET /api/menu/items/:id/recipe
  // =========================================================================
  describe('GET /api/menu/items/:id/recipe', () => {
    it('returns empty recipe structure when menu item has no recipe configured yet', async () => {
      const req = createRequest(`http://localhost:3000/api/menu/items/${testMenuItemId}/recipe`);
      const res = await getMenuItemRecipeHandler(req, { params: { id: testMenuItemId } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.recipe).toBeNull();
      expect(json.data.activeVersion).toBeNull();
      expect(json.data.draftVersion).toBeNull();
      expect(json.data.versions).toEqual([]);
    });

    it('returns 404 for a non-existent menu item', async () => {
      const nonExistentId = '00000000-0000-0000-0000-999999999999';
      const req = createRequest(`http://localhost:3000/api/menu/items/${nonExistentId}/recipe`);
      const res = await getMenuItemRecipeHandler(req, { params: { id: nonExistentId } });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  // =========================================================================
  // 4. ROUTE: POST /api/menu/items/:id/recipe/versions (Create Draft)
  // =========================================================================
  describe('POST /api/menu/items/:id/recipe/versions', () => {
    it('returns 400 when ingredients array is empty', async () => {
      const req = createRequest(`http://localhost:3000/api/menu/items/${testMenuItemId}/recipe/versions`, {
        method: 'POST',
        body: { ingredients: [] }
      });
      const res = await createRecipeVersionHandler(req, { params: { id: testMenuItemId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 when duplicate inventory items are submitted in ingredients', async () => {
      const req = createRequest(`http://localhost:3000/api/menu/items/${testMenuItemId}/recipe/versions`, {
        method: 'POST',
        body: {
          ingredients: [
            { inventoryItemId: testInventoryItem1, quantity: 1 },
            { inventoryItemId: testInventoryItem1, quantity: 2 }
          ]
        }
      });
      const res = await createRecipeVersionHandler(req, { params: { id: testMenuItemId } });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe('DUPLICATE_RECIPE_INGREDIENT');
    });

    it('returns 400 MenuItemArchivedError when targeting an archived menu item', async () => {
      const req = createRequest(`http://localhost:3000/api/menu/items/${testArchivedMenuItemId}/recipe/versions`, {
        method: 'POST',
        body: {
          ingredients: [{ inventoryItemId: testInventoryItem1, quantity: 1 }]
        }
      });
      const res = await createRecipeVersionHandler(req, { params: { id: testArchivedMenuItemId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('MENU_ITEM_ARCHIVED');
    });

    it('successfully creates draft version and returns 201 Created', async () => {
      const req = createRequest(`http://localhost:3000/api/menu/items/${testMenuItemId}/recipe/versions`, {
        method: 'POST',
        body: {
          ingredients: [
            { inventoryItemId: testInventoryItem1, quantity: 1.0, note: 'Top and bottom buns' },
            { inventoryItemId: testInventoryItem2, quantity: 1.0, wastageAllowancePct: 2.5 }
          ],
          note: 'Initial draft v1'
        }
      });
      const res = await createRecipeVersionHandler(req, { params: { id: testMenuItemId } });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data).toHaveProperty('id');
      expect(json.data.versionNumber).toBe(1);
      expect(json.data.status).toBe('DRAFT');
      expect(json.data.ingredients).toHaveLength(2);
      expect(json.data.note).toBe('Initial draft v1');

      createdDraftVersionId = json.data.id;
    });

    it('subsequent GET /api/menu/items/:id/recipe now returns the recipe and draft version', async () => {
      const req = createRequest(`http://localhost:3000/api/menu/items/${testMenuItemId}/recipe`);
      const res = await getMenuItemRecipeHandler(req, { params: { id: testMenuItemId } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.recipe.status).toBe('INACTIVE');
      expect(json.data.draftVersion).not.toBeNull();
      expect(json.data.draftVersion.id).toBe(createdDraftVersionId);
      expect(json.data.activeVersion).toBeNull();
      expect(json.data.versions).toHaveLength(1);
    });
  });

  // =========================================================================
  // 5. ROUTE: PATCH /api/recipe-versions/:id (Update Draft)
  // =========================================================================
  describe('PATCH /api/recipe-versions/:id', () => {
    it('returns 400 when quantity is invalid (<= 0)', async () => {
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${createdDraftVersionId}`, {
        method: 'PATCH',
        body: {
          ingredients: [{ inventoryItemId: testInventoryItem1, quantity: -5 }]
        }
      });
      const res = await updateRecipeVersionHandler(req, { params: { id: createdDraftVersionId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('successfully updates ingredients and note of draft version -> 200 OK', async () => {
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${createdDraftVersionId}`, {
        method: 'PATCH',
        body: {
          ingredients: [
            { inventoryItemId: testInventoryItem1, quantity: 2.0, note: 'Double bun' }
          ],
          note: 'Updated draft v1'
        }
      });
      const res = await updateRecipeVersionHandler(req, { params: { id: createdDraftVersionId } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe(createdDraftVersionId);
      expect(json.data.ingredients).toHaveLength(1);
      expect(Number(json.data.ingredients[0].quantity)).toBe(2);
      expect(json.data.note).toBe('Updated draft v1');
    });
  });

  // =========================================================================
  // 6. ROUTE: POST /api/recipe-versions/:id/activate
  // =========================================================================
  describe('POST /api/recipe-versions/:id/activate', () => {
    it('successfully activates the draft version with a valid Idempotency-Key header -> 200 OK', async () => {
      const idempotencyKey = `test-route-activate-${Date.now()}`;
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${createdDraftVersionId}/activate`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      const res = await activateRecipeVersionHandler(req, { params: { id: createdDraftVersionId } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe(createdDraftVersionId);
      expect(json.data.status).toBe('ACTIVE');
      expect(json.data.effectiveFrom).not.toBeNull();

      activeVersionId = createdDraftVersionId;

      // Repeat request with same Idempotency-Key header -> receives cached response
      const reqRepeat = createRequest(`http://localhost:3000/api/recipe-versions/${createdDraftVersionId}/activate`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      const resRepeat = await activateRecipeVersionHandler(reqRepeat, { params: { id: createdDraftVersionId } });
      expect(resRepeat.status).toBe(200);
      const jsonRepeat = await resRepeat.json();
      expect(jsonRepeat.data.id).toBe(createdDraftVersionId);
      expect(jsonRepeat.data.status).toBe('ACTIVE');
    });

    it('proves activation does not depend on or store a body idempotency key', async () => {
      // 1. Create a second draft version
      const draftReq = createRequest(`http://localhost:3000/api/menu/items/${testMenuItemId}/recipe/versions`, {
        method: 'POST',
        body: {
          ingredients: [
            { inventoryItemId: testInventoryItem1, quantity: 1.5 },
            { inventoryItemId: testInventoryItem2, quantity: 1.0 }
          ],
          note: 'Second draft v2'
        }
      });
      const draftRes = await createRecipeVersionHandler(draftReq, { params: { id: testMenuItemId } });
      expect(draftRes.status).toBe(201);
      const draftJson = await draftRes.json();
      const draftV2Id = draftJson.data.id;

      // 2. Activate v2 passing idempotencyKey ONLY in JSON body, with NO header
      const bodyKey = `test-route-body-only-key-${Date.now()}`;
      const actReq = createRequest(`http://localhost:3000/api/recipe-versions/${draftV2Id}/activate`, {
        method: 'POST',
        body: { idempotencyKey: bodyKey, confirm: true }
      });
      const actRes = await activateRecipeVersionHandler(actReq, { params: { id: draftV2Id } });
      expect(actRes.status).toBe(200);
      const actJson = await actRes.json();
      expect(actJson.data.id).toBe(draftV2Id);
      expect(actJson.data.status).toBe('ACTIVE');

      // 3. Confirm body key was NOT recorded into idempotency store
      const dbCheck = await query('SELECT * FROM idempotency WHERE key = $1', [bodyKey]);
      expect(dbCheck.rows.length).toBe(0);

      activeVersionId = draftV2Id;
    });

    it('rejects activating an already ACTIVE version with 400 Bad Request', async () => {
      const newKey = `test-route-activate-dup-${Date.now()}`;
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${activeVersionId}/activate`, {
        method: 'POST',
        headers: { 'idempotency-key': newKey }
      });
      const res = await activateRecipeVersionHandler(req, { params: { id: activeVersionId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('RECIPE_VERSION_NOT_DRAFT');
    });

    it('rejects editing an ACTIVE version with PATCH -> 400 Bad Request', async () => {
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${activeVersionId}`, {
        method: 'PATCH',
        body: {
          ingredients: [
            { inventoryItemId: testInventoryItem1, quantity: 1 }
          ],
          note: 'Trying to modify active version'
        }
      });
      const res = await updateRecipeVersionHandler(req, { params: { id: activeVersionId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('RECIPE_VERSION_NOT_DRAFT');
    });
  });

  // =========================================================================
  // 7. ROUTE: POST /api/recipe-versions/:id/deactivate
  // =========================================================================
  describe('POST /api/recipe-versions/:id/deactivate', () => {
    it('rejects deactivation without reason with 400 VALIDATION_ERROR', async () => {
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${activeVersionId}/deactivate`, {
        method: 'POST',
        body: { confirm: true }
      });
      const res = await deactivateRecipeVersionHandler(req, { params: { id: activeVersionId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects deactivation when reason is whitespace with 400 VALIDATION_ERROR', async () => {
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${activeVersionId}/deactivate`, {
        method: 'POST',
        body: { confirm: true, reason: '    ' }
      });
      const res = await deactivateRecipeVersionHandler(req, { params: { id: activeVersionId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('successfully deactivates the active version with confirm: true, valid reason, and X-Idempotency-Key header -> 200 OK', async () => {
      const idempotencyKey = `test-route-deactivate-${Date.now()}`;
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${activeVersionId}/deactivate`, {
        method: 'POST',
        headers: { 'X-Idempotency-Key': idempotencyKey },
        body: { confirm: true, reason: 'Seasonal menu rotation' }
      });
      const res = await deactivateRecipeVersionHandler(req, { params: { id: activeVersionId } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.versionId).toBe(activeVersionId);
      expect(json.data.status).toBe('INACTIVE');

      // Replay request with same X-Idempotency-Key header -> receives cached response
      const reqRepeat = createRequest(`http://localhost:3000/api/recipe-versions/${activeVersionId}/deactivate`, {
        method: 'POST',
        headers: { 'X-Idempotency-Key': idempotencyKey },
        body: { confirm: true, reason: 'Seasonal menu rotation' }
      });
      const resRepeat = await deactivateRecipeVersionHandler(reqRepeat, { params: { id: activeVersionId } });
      expect(resRepeat.status).toBe(200);
      const jsonRepeat = await resRepeat.json();
      expect(jsonRepeat.data.versionId).toBe(activeVersionId);
      expect(jsonRepeat.data.status).toBe('INACTIVE');

      // Check menu item recipe status is now INACTIVE and activeVersion is null
      const checkReq = createRequest(`http://localhost:3000/api/menu/items/${testMenuItemId}/recipe`);
      const checkRes = await getMenuItemRecipeHandler(checkReq, { params: { id: testMenuItemId } });
      const checkJson = await checkRes.json();
      expect(checkJson.data.recipe.status).toBe('INACTIVE');
      expect(checkJson.data.activeVersion).toBeNull();
    });

    it('rejects deactivating an already INACTIVE version with 409 Conflict', async () => {
      const newKey = `test-route-deact-inactive-${Date.now()}`;
      const req = createRequest(`http://localhost:3000/api/recipe-versions/${activeVersionId}/deactivate`, {
        method: 'POST',
        headers: { 'idempotency-key': newKey },
        body: { confirm: true, reason: 'Double deactivation' }
      });
      const res = await deactivateRecipeVersionHandler(req, { params: { id: activeVersionId } });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe('RECIPE_CONFLICT');
    });
  });
});
